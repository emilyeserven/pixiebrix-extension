/* eslint-disable jest/expect-expect -- assertions in expectActions helper function */
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

/// <reference types="jest-extended" />

import { renderHook } from "@testing-library/react-hooks";
import { extensionFactory, recipeFactory } from "@/testUtils/factories";
import useInstallableViewItemActions, {
  type InstallableViewItemActions,
} from "@/options/pages/blueprints/useInstallableViewItemActions";
import useFlags from "@/hooks/useFlags";
import {
  type InstallableStatus,
  type InstallableViewItem,
  type SharingType,
} from "@/options/pages/blueprints/blueprintsTypes";
import useInstallablePermissions from "@/options/pages/blueprints/useInstallablePermissions";
import { useDeleteCloudExtensionMutation } from "@/services/api";
import { uniq } from "lodash";
import { uuidv4 } from "@/types/helpers";

jest.mock("react-redux", () => ({
  useSelector: jest.fn(),
  useDispatch: jest.fn(() => jest.fn()),
}));

jest.mock("@/hooks/useFlags", () => jest.fn());
jest.mock("@/options/pages/blueprints/useInstallablePermissions", () =>
  jest.fn()
);
jest.mock("@/services/api", () => ({
  useDeleteCloudExtensionMutation: jest.fn(),
}));

const expectActions = (
  expectedActions: string[],
  actualActions: InstallableViewItemActions
) => {
  // Union both set of keys to ensure all possible keys are covered
  const allActions = uniq([...Object.keys(actualActions), ...expectedActions]);
  const expected = Object.fromEntries(
    allActions.map((action) => [
      action,
      expectedActions.includes(action)
        ? expect.not.toBeNil()
        : expect.toBeNil(),
    ])
  );
  expect(actualActions).toStrictEqual(expected);
};

const mockHooks = ({
  restricted = false,
  hasPermissions = true,
}: { restricted?: boolean; hasPermissions?: boolean } = {}) => {
  (useFlags as jest.Mock).mockImplementation(() => ({
    permit: () => !restricted,
    restrict: () => restricted,
  }));

  (useInstallablePermissions as jest.Mock).mockImplementation(() => ({
    hasPermissions,
    requestPermissions() {},
  }));

  (useDeleteCloudExtensionMutation as jest.Mock).mockImplementation(() => [
    jest.fn(),
  ]);
};

const installableItemFactory = ({
  isExtension = false,
  sharingType = "Personal",
  status = "Active",
}: {
  isExtension: boolean;
  sharingType: SharingType;
  status: InstallableStatus;
}) =>
  ({
    installable: isExtension ? extensionFactory() : recipeFactory(),
    sharing: {
      source: {
        type: sharingType,
      },
    },
    status,
  } as InstallableViewItem);

afterEach(() => {
  jest.resetAllMocks();
});

describe("useInstallableViewItemActions", () => {
  test("cloud extension", () => {
    mockHooks();
    const cloudExtensionItem = installableItemFactory({
      isExtension: true,
      sharingType: "Personal",
      status: "Inactive",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useInstallableViewItemActions(cloudExtensionItem));
    expectActions(
      ["viewPublish", "viewShare", "activate", "deleteExtension"],
      actions
    );
  });

  test("active personal extension", () => {
    mockHooks();
    const personalExtensionItem = installableItemFactory({
      isExtension: true,
      sharingType: "Personal",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useInstallableViewItemActions(personalExtensionItem));
    expectActions(
      ["viewPublish", "viewShare", "uninstall", "viewLogs"],
      actions
    );
  });

  test("active personal blueprint", () => {
    mockHooks();
    const personalBlueprintItem = installableItemFactory({
      isExtension: false,
      sharingType: "Personal",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useInstallableViewItemActions(personalBlueprintItem));
    expectActions(
      ["viewPublish", "viewShare", "uninstall", "viewLogs", "reinstall"],
      actions
    );
  });

  test("inactive personal blueprint", () => {
    mockHooks();
    const personalBlueprintItem = installableItemFactory({
      isExtension: false,
      sharingType: "Personal",
      status: "Inactive",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useInstallableViewItemActions(personalBlueprintItem));
    expectActions(["viewPublish", "viewShare", "activate"], actions);
  });

  test("active team blueprint", () => {
    mockHooks();
    const teamBlueprintItem = installableItemFactory({
      isExtension: false,
      sharingType: "Team",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useInstallableViewItemActions(teamBlueprintItem));
    expectActions(
      ["viewPublish", "viewShare", "uninstall", "viewLogs", "reinstall"],
      actions
    );
  });

  test("inactive team blueprint", () => {
    mockHooks();
    const teamBlueprintItem = installableItemFactory({
      isExtension: false,
      sharingType: "Team",
      status: "Inactive",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useInstallableViewItemActions(teamBlueprintItem));
    expectActions(["viewPublish", "viewShare", "activate"], actions);
  });

  test("public blueprint", () => {
    mockHooks();
    const publicBlueprintItem = installableItemFactory({
      isExtension: false,
      sharingType: "Personal",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useInstallableViewItemActions(publicBlueprintItem));
    expectActions(
      ["viewPublish", "viewShare", "reinstall", "viewLogs", "uninstall"],
      actions
    );
  });

  test("team deployment for unrestricted user", () => {
    mockHooks({ restricted: false });
    const deploymentItem = installableItemFactory({
      isExtension: false,
      sharingType: "Deployment",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useInstallableViewItemActions(deploymentItem));
    expectActions(["reinstall", "uninstall", "viewLogs"], actions);
  });

  test("restricted team deployment", () => {
    mockHooks({ restricted: true });
    const deploymentItem = installableItemFactory({
      isExtension: false,
      sharingType: "Deployment",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useInstallableViewItemActions(deploymentItem));
    expectActions(["viewLogs"], actions);
  });

  test("blueprint with missing permissions", () => {
    mockHooks({ hasPermissions: false });
    const deploymentItem = installableItemFactory({
      isExtension: false,
      sharingType: "Team",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useInstallableViewItemActions(deploymentItem));
    expectActions(
      [
        "viewPublish",
        "viewShare",
        "uninstall",
        "viewLogs",
        "requestPermissions",
        "reinstall",
      ],
      actions
    );
  });

  test("paused deployment with unrestricted user", () => {
    mockHooks({ restricted: false });
    const deploymentItem = installableItemFactory({
      isExtension: false,
      sharingType: "Deployment",
      status: "Paused",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useInstallableViewItemActions(deploymentItem));

    // Unrestricted users (e.g., developers) need to be able to uninstall/reactivate a deployment to use a later
    // version of the blueprint for development/testing.
    expectActions(["viewLogs", "uninstall", "reinstall"], actions);
  });

  test("paused deployment with restricted user", () => {
    mockHooks({ restricted: true });
    const deploymentItem = installableItemFactory({
      isExtension: false,
      sharingType: "Deployment",
      status: "Paused",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useInstallableViewItemActions(deploymentItem));

    expectActions(["viewLogs"], actions);
  });

  describe("public blueprint", () => {
    let blueprintItem: InstallableViewItem;
    beforeEach(() => {
      mockHooks();

      blueprintItem = {
        installable: recipeFactory({
          sharing: { public: true, organizations: [] },
        }),
        sharing: {
          source: {
            type: "Personal",
          },
        },
        status: "Active",
      } as InstallableViewItem;
    });

    test("pending publish", () => {
      const {
        result: { current: actions },
      } = renderHook(() => useInstallableViewItemActions(blueprintItem));
      expectActions(
        ["viewPublish", "viewShare", "uninstall", "viewLogs", "reinstall"],
        actions
      );
    });

    test("published", () => {
      blueprintItem.sharing.listingId = uuidv4();

      const {
        result: { current: actions },
      } = renderHook(() => useInstallableViewItemActions(blueprintItem));
      expectActions(
        [
          "viewInMarketplaceHref",
          "viewShare",
          "uninstall",
          "viewLogs",
          "reinstall",
        ],
        actions
      );
    });
  });
});
