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

import React from "react";
import { fromJS } from "@/services/factory";
import ServiceEditorModal from "@/options/pages/services/ServiceEditorModal";
import { render, screen } from "@/options/testHelpers";
import { waitForEffect } from "@/testUtils/testHelpers";

// FIXME: this is coming through as a module with default being a JSON object. (yaml-jest-transform is being applied)
import pipedriveYaml from "@contrib/services/pipedrive.yaml?loadAsText";
import { type RawServiceConfiguration } from "@/core";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";

beforeAll(() => {
  registerDefaultWidgets();
});

describe("ServiceEditorModal", () => {
  test("Can render Pipedrive configuration modal without existing configuration", async () => {
    const service = fromJS(pipedriveYaml as any);

    render(
      <ServiceEditorModal
        configuration={{ label: "" } as RawServiceConfiguration}
        onDelete={jest.fn()}
        onSave={jest.fn()}
        onClose={jest.fn()}
        service={service}
      />
    );

    await waitForEffect();

    expect(screen.getByDisplayValue("pipedrive/api")).not.toBeNull();
    expect(screen.getByText("Save")).not.toBeNull();
    expect(screen.getByText("Delete")).not.toBeNull();
    expect(screen.getByText("Close")).not.toBeNull();

    const dialogRoot = screen.getByRole("dialog");
    expect(dialogRoot).toMatchSnapshot();
  });
});
