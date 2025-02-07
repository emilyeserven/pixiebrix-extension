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

import { proxyService } from "@/background/messenger/api";
import { Transformer } from "@/types";
import {
  type BlockArg,
  type BlockOptions,
  type RegistryId,
  type Schema,
  type SchemaProperties,
} from "@/core";
import { pollUntilTruthy } from "@/utils";
import { validateRegistryId } from "@/types/helpers";
import { BusinessError } from "@/errors/businessErrors";

export const UIPATH_SERVICE_IDS: RegistryId[] = [
  "uipath/cloud",
  "uipath/cloud-oauth",
  "uipath/orchestrator",
].map((x) => validateRegistryId(x));
export const UIPATH_ID = validateRegistryId("@pixiebrix/uipath/process");

const DEFAULT_MAX_WAIT_MILLIS = 30_000;
const POLL_MILLIS = 1000;

export const UIPATH_PROPERTIES: SchemaProperties = {
  uipath: {
    anyOf: [
      {
        $ref: "https://app.pixiebrix.com/schemas/services/uipath/cloud",
      },
      {
        $ref: "https://app.pixiebrix.com/schemas/services/uipath/orchestrator",
      },
      {
        $ref: "https://app.pixiebrix.com/schemas/services/uipath/cloud-oauth",
      },
    ],
  },
  releaseKey: {
    type: "string",
  },
  strategy: {
    type: "string",
    default: "JobsCount",
    enum: ["All", "Specific", "JobsCount"],
    description: "How the process should be run",
  },
  robotIds: {
    type: "array",
    items: {
      type: "number",
    },
  },
  jobsCount: {
    type: "number",
    description:
      "When using strategy JobsCount, the process will run x times where x is the value of the JobsCount field.",
  },
  awaitResult: {
    type: "boolean",
    default: false,
    description: "Wait for the process to complete and output the results.",
  },
  maxWaitMillis: {
    type: "number",
    default: DEFAULT_MAX_WAIT_MILLIS,
    description:
      "Maximum time (in milliseconds) to wait for the process to complete when awaiting result.",
  },
  inputArguments: {
    type: "object",
    additionalProperties: true,
  },
};

interface JobsResponse {
  "@odata.context": "https://cloud.uipath.com/odata/$metadata#Jobs";
  "@odata.count": number;
  value: Array<{
    Id: number;
    Key: string;
    State: "Successful" | "Pending" | "Faulted";
    OutputArguments: string;
    Info: string;
  }>;
}

export class RunProcess extends Transformer {
  constructor() {
    super(
      UIPATH_ID,
      "Run a UiPath process",
      "Run a UiPath process using UiPath Orchestrator"
    );
  }

  inputSchema: Schema = {
    $schema: "https://json-schema.org/draft/2019-09/schema#",
    type: "object",
    required: ["uipath", "releaseKey"],
    properties: UIPATH_PROPERTIES,
  };

  async transform(
    {
      uipath,
      releaseKey,
      strategy = "JobsCount",
      jobsCount = 0,
      robotIds = [],
      awaitResult = false,
      maxWaitMillis = DEFAULT_MAX_WAIT_MILLIS,
      inputArguments = {},
    }: BlockArg,
    { logger }: BlockOptions
  ): Promise<unknown> {
    const responsePromise = proxyService<JobsResponse>(uipath, {
      url: "/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs",
      method: "post",
      data: {
        startInfo: {
          ReleaseKey: releaseKey,
          Strategy: strategy,
          JobsCount: jobsCount,
          RobotIds: robotIds,
          Source: "Manual",
          InputArguments: JSON.stringify(inputArguments),
        },
      },
    });

    if (!awaitResult) {
      return {};
    }

    const { data: startData } = await responsePromise;

    if (startData.value.length > 1) {
      throw new BusinessError(
        "Awaiting response of multiple jobs not supported"
      );
    }

    const poll = async () => {
      const { data: resultData } = await proxyService<JobsResponse>(uipath, {
        url: `/odata/Jobs?$filter=Id eq ${startData.value[0].Id}`,
        method: "get",
      });

      if (resultData.value.length === 0) {
        logger.error(`UiPath job not found: ${startData.value[0].Id}`);
        throw new BusinessError("UiPath job not found");
      }

      if (resultData.value[0].State === "Successful") {
        return JSON.parse(resultData.value[0].OutputArguments);
      }

      if (resultData.value[0].State === "Faulted") {
        logger.error(`UiPath job failed: ${resultData.value[0].Info}`);
        throw new BusinessError("UiPath job failed");
      }
    };

    const result = await pollUntilTruthy(poll, {
      intervalMillis: POLL_MILLIS,
      maxWaitMillis,
    });

    if (result) {
      return result;
    }

    throw new BusinessError(
      `UiPath job did not finish in ${Math.round(maxWaitMillis / 1000)} seconds`
    );
  }
}
