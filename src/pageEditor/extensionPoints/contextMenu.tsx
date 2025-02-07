/* eslint-disable filenames/match-exported */
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

import { type IExtension, type Metadata } from "@/core";
import {
  baseFromExtension,
  baseSelectExtension,
  baseSelectExtensionPoint,
  cleanIsAvailable,
  getImplicitReader,
  lookupExtensionPoint,
  makeInitialBaseState,
  makeIsAvailable,
  extensionWithNormalizedPipeline,
  PAGE_EDITOR_DEFAULT_BRICK_API_VERSION,
  removeEmptyValues,
  selectIsAvailable,
} from "@/pageEditor/extensionPoints/base";
import { uuidv4 } from "@/types/helpers";
import { type ExtensionPointConfig } from "@/extensionPoints/types";
import {
  type ContextMenuConfig,
  ContextMenuExtensionPoint,
  type MenuDefinition,
} from "@/extensionPoints/contextMenu";
import { getDomain } from "@/permissions/patterns";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import {
  type ElementConfig,
  type SingleLayerReaderConfig,
} from "@/pageEditor/extensionPoints/elementConfig";
import React from "react";
import ContextMenuConfiguration from "@/pageEditor/tabs/contextMenu/ContextMenuConfiguration";
import type { DynamicDefinition } from "@/contentScript/pageEditor/types";
import { type ContextMenuFormState } from "./formStateTypes";
import { omitEditorMetadata } from "./pipelineMapping";
import { makeEmptyPermissions } from "@/utils/permissions";

function fromNativeElement(
  url: string,
  metadata: Metadata
): ContextMenuFormState {
  const base = makeInitialBaseState();

  const isAvailable = makeIsAvailable(url);

  const title = "Context menu item";

  return {
    type: "contextMenu",
    // To simplify the interface, this is kept in sync with the caption
    label: title,
    ...base,
    extensionPoint: {
      metadata,
      definition: {
        type: "contextMenu",
        reader: getImplicitReader("contextMenu"),
        documentUrlPatterns: isAvailable.matchPatterns,
        contexts: ["all"],
        targetMode: "eventTarget",
        defaultOptions: {},
        isAvailable,
      },
    },
    extension: {
      title,
      blockPipeline: [],
    },
  };
}

function selectExtensionPointConfig(
  formState: ContextMenuFormState
): ExtensionPointConfig<MenuDefinition> {
  const { extensionPoint } = formState;
  const {
    definition: {
      isAvailable,
      documentUrlPatterns,
      reader,
      targetMode,
      contexts = ["all"],
    },
  } = extensionPoint;
  return removeEmptyValues({
    ...baseSelectExtensionPoint(formState),
    definition: {
      type: "contextMenu",
      documentUrlPatterns,
      contexts,
      targetMode,
      reader,
      isAvailable: cleanIsAvailable(isAvailable),
    },
  });
}

function selectExtension(
  state: ContextMenuFormState,
  options: { includeInstanceIds?: boolean } = {}
): IExtension<ContextMenuConfig> {
  const { extension } = state;
  const config: ContextMenuConfig = {
    title: extension.title,
    action: options.includeInstanceIds
      ? extension.blockPipeline
      : omitEditorMetadata(extension.blockPipeline),
  };
  return removeEmptyValues({
    ...baseSelectExtension(state),
    config,
  });
}

async function fromExtension(
  config: IExtension<ContextMenuConfig>
): Promise<ContextMenuFormState> {
  const extensionPoint = await lookupExtensionPoint<
    MenuDefinition,
    ContextMenuConfig,
    "contextMenu"
  >(config, "contextMenu");
  const { documentUrlPatterns, defaultOptions, contexts, targetMode, reader } =
    extensionPoint.definition;

  const base = baseFromExtension(config, extensionPoint.definition.type);
  const extension = await extensionWithNormalizedPipeline(
    config.config,
    "action"
  );

  return {
    ...base,

    extension,

    extensionPoint: {
      metadata: extensionPoint.metadata,
      definition: {
        type: "contextMenu",
        documentUrlPatterns,
        defaultOptions,
        targetMode,
        contexts,
        // See comment on SingleLayerReaderConfig
        reader: reader as SingleLayerReaderConfig,
        isAvailable: selectIsAvailable(extensionPoint),
      },
    },
  };
}

async function fromExtensionPoint(
  url: string,
  extensionPoint: ExtensionPointConfig<MenuDefinition>
): Promise<ContextMenuFormState> {
  if (extensionPoint.definition.type !== "contextMenu") {
    throw new Error("Expected contextMenu extension point type");
  }

  const {
    defaultOptions = {},
    documentUrlPatterns = [],
    targetMode = "legacy",
    type,
    reader,
  } = extensionPoint.definition;

  return {
    uuid: uuidv4(),
    apiVersion: PAGE_EDITOR_DEFAULT_BRICK_API_VERSION,
    installed: true,
    type,
    label: `My ${getDomain(url)} context menu`,

    services: [],
    permissions: makeEmptyPermissions(),
    optionsArgs: {},

    extension: {
      title: defaultOptions.title ?? "Custom Action",
      blockPipeline: [],
    },

    extensionPoint: {
      metadata: extensionPoint.metadata,
      definition: {
        ...extensionPoint.definition,
        defaultOptions,
        documentUrlPatterns,
        targetMode,
        // See comment on SingleLayerReaderConfig
        reader: reader as SingleLayerReaderConfig,
        isAvailable: selectIsAvailable(extensionPoint),
      },
    },

    recipe: undefined,
  };
}

function asDynamicElement(element: ContextMenuFormState): DynamicDefinition {
  return {
    type: "contextMenu",
    extension: selectExtension(element, { includeInstanceIds: true }),
    extensionPointConfig: selectExtensionPointConfig(element),
  };
}

const config: ElementConfig<undefined, ContextMenuFormState> = {
  displayOrder: 1,
  elementType: "contextMenu",
  label: "Context Menu",
  baseClass: ContextMenuExtensionPoint,
  EditorNode: ContextMenuConfiguration,
  selectNativeElement: undefined,
  icon: faBars,
  fromNativeElement,
  fromExtensionPoint,
  asDynamicElement,
  selectExtensionPointConfig,
  selectExtension,
  fromExtension,
  InsertModeHelpText: () => (
    <div>
      <p>
        A context menu (also called a right-click menu) can be configured to
        appear when you right click on a page, text selection, or other content.
      </p>

      <p>
        Search for an existing context menu in the marketplace, or start from
        scratch to have full control over how your context menu appears.
      </p>
    </div>
  ),
};

export default config;
