/*
 * Copyright (C) 2023 PixieBrix, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { type SanitizedAuth } from "@/types/contract";
import {
  type SanitizedServiceConfiguration,
  type IService,
  type RawServiceConfiguration,
  type ServiceConfig,
  type SanitizedConfig,
  type KeyedConfig,
  type RegistryId,
  type UUID,
} from "@/core";
import { sortBy, isEmpty } from "lodash";
import registry, { readRawConfigurations } from "@/services/registry";
import { inputProperties } from "@/helpers";
import { fetch } from "@/hooks/fetch";
import { validateRegistryId } from "@/types/helpers";
import { PIXIEBRIX_SERVICE_ID } from "@/services/constants";
import { expectContext, forbidContext } from "@/utils/expectContext";
import { ExtensionNotLinkedError } from "@/errors/genericErrors";
import {
  MissingConfigurationError,
  NotConfiguredError,
} from "@/errors/businessErrors";
import { DoesNotExistError } from "@/baseRegistry";
import { type Service } from "@/types";

const REF_SECRETS = [
  "https://app.pixiebrix.com/schemas/key#",
  "https://app.pixiebrix.com/schemas/key",
];

enum ServiceLevel {
  Private = 0,
  Team,
  BuiltIn,
}

/** Return config excluding any secrets/keys. */
function excludeSecrets(
  service: IService,
  config: KeyedConfig
): SanitizedConfig {
  const result: SanitizedConfig = {} as SanitizedConfig;
  for (const [key, type] of Object.entries(inputProperties(service.schema))) {
    // @ts-expect-error: ts doesn't think $ref can be on SchemaDefinition
    if (!REF_SECRETS.includes(type.$ref)) {
      // Safe because we're getting from Object.entries
      // eslint-disable-next-line security/detect-object-injection
      result[key] = config[key];
    }
  }

  return result;
}

export async function pixieServiceFactory(): Promise<SanitizedServiceConfiguration> {
  return {
    id: undefined,
    serviceId: PIXIEBRIX_SERVICE_ID,
    // Don't need to proxy requests to our own service
    proxy: false,
    config: {} as SanitizedConfig,
  } as SanitizedServiceConfiguration;
}

type Option = {
  id: UUID;
  serviceId: RegistryId;
  level: ServiceLevel;
  local: boolean;
  config: ServiceConfig | SanitizedConfig;
};

let wasInitialized = false;

/**
 * Singleton class that produces `ServiceLocator` methods via `getLocator`.
 *
 * NOTE: this class handles service credentials, not the service definitions. For service definitions, see the
 * `services.registry` file.
 */
class LazyLocatorFactory {
  private remote: SanitizedAuth[] = [];

  private local: RawServiceConfiguration[] = [];

  private options: Option[];

  private _initialized = false;

  private _refreshPromise: Promise<void>;

  private updateTimestamp: number = undefined;

  constructor() {
    forbidContext(
      "contentScript",
      "LazyLocatorFactory cannot run in the contentScript"
    );

    if (wasInitialized) {
      throw new Error("LazyLocatorFactory is a singleton class");
    }

    wasInitialized = true;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  async refreshRemote(): Promise<void> {
    try {
      // As of https://github.com/pixiebrix/pixiebrix-app/issues/562, the API gradually handles unauthenticated calls
      // to this endpoint. However, there's no need to pull the built-in services since the user can't call them
      // without being authenticated
      this.remote = await fetch<SanitizedAuth[]>(
        "/api/services/shared/?meta=1",
        { requireLinked: true }
      );
      console.debug(`Fetched ${this.remote.length} remote service auth(s)`);
    } catch (error) {
      if (error instanceof ExtensionNotLinkedError) {
        this.remote = [];
      } else {
        throw error;
      }
    }

    this.initializeOptions();
  }

  async refreshLocal(): Promise<void> {
    this.local = await readRawConfigurations();
    this.initializeOptions();
  }

  async refresh(): Promise<void> {
    // Avoid multiple concurrent requests. Could potentially replace with debouncer with both leading/trailing: true
    // For example: https://github.com/sindresorhus/promise-fun/issues/15
    this._refreshPromise = this._refreshPromise ?? this._refresh();
    try {
      await this._refreshPromise;
    } finally {
      this._refreshPromise = undefined;
    }
  }

  private async _refresh(): Promise<void> {
    const timestamp = Date.now();
    await Promise.all([this.refreshLocal(), this.refreshRemote()]);
    this.initializeOptions();
    this._initialized = true;
    this.updateTimestamp = timestamp;
    console.debug("Refreshed service configuration locator", {
      updateTimestamp: this.updateTimestamp,
    });
  }

  private initializeOptions() {
    this.options = sortBy(
      [
        ...this.local.map((x) => ({
          ...x,
          level: ServiceLevel.Private,
          local: true,
        })),
        ...(this.remote ?? []).map((x) => ({
          ...x,
          level: x.organization ? ServiceLevel.Team : ServiceLevel.BuiltIn,
          local: false,
          serviceId: validateRegistryId(x.service.name),
        })),
      ],
      (x) => x.level
    );
  }

  /**
   * Return the raw integration configuration with UUID authId, or return `null` if not available locally.
   * @param authId UUID of the integration configuration
   */
  async getLocalConfig(authId: UUID): Promise<RawServiceConfiguration | null> {
    // The `initialized` flag gets set from _refresh, which covers both local and remote. For performance,
    // we could split the initialized flag into two, but it's not worth it since refreshLocal is fast.
    if (!this.initialized) {
      await this.refreshLocal();
    }

    return this.local.find((x) => x.id === authId);
  }

  async locateAllForService(
    serviceId: RegistryId
  ): Promise<SanitizedServiceConfiguration[]> {
    if (!this.initialized) {
      await this.refresh();
    }

    if (serviceId === PIXIEBRIX_SERVICE_ID) {
      // HACK: for now use the separate storage for the extension key
      return [await pixieServiceFactory()];
    }

    let service: Service;

    // Handle case where locateAllForService is called before service definitions are loaded. (For example, because it's
    // being called from the background page in installer.ts).
    // In the future, we may want to expose an option on the method to control this behavior.
    try {
      service = await registry.lookup(serviceId);
    } catch (error) {
      if (error instanceof DoesNotExistError) {
        return [];
      }

      throw error;
    }

    return this.options
      .filter((x) => x.serviceId === serviceId)
      .map((match) => ({
        _sanitizedServiceConfigurationBrand: undefined,
        id: match.id,
        serviceId,
        proxy: service.hasAuth && !match.local,
        config: excludeSecrets(service, match.config),
      }));
  }

  async locate(
    serviceId: RegistryId,
    authId: UUID
  ): Promise<SanitizedServiceConfiguration> {
    expectContext(
      "background",
      "The service locator must run in the background worker"
    );

    if (!this.initialized) {
      await this.refresh();
    }

    if (serviceId === PIXIEBRIX_SERVICE_ID) {
      // HACK: for now use the separate storage for the extension key
      return pixieServiceFactory();
    }

    if (!authId) {
      throw new NotConfiguredError(
        `No configuration selected for ${serviceId}`,
        serviceId
      );
    }

    const service = await registry.lookup(serviceId);

    const match = this.options.find(
      (x) => x.serviceId === serviceId && x.id === authId
    );

    if (!match) {
      throw new MissingConfigurationError(
        `Configuration ${authId} not found for ${serviceId}`,
        serviceId,
        authId
      );
    }

    if (isEmpty(match.config)) {
      console.warn(`Config ${authId} for service ${serviceId} is empty`);
    }

    console.debug(`Locate auth for ${serviceId}`, {
      currentTimestamp: Date.now(),
      updateTimestamp: this.updateTimestamp,
      id: authId,
      config: match.config,
      proxy: service.hasAuth && !match.local,
    });

    return {
      _sanitizedServiceConfigurationBrand: undefined,
      id: authId,
      serviceId,
      proxy: service.hasAuth && !match.local,
      config: excludeSecrets(service, match.config),
    };
  }
}

export default LazyLocatorFactory;
