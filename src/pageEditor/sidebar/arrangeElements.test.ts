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

import {
  extensionFactory,
  installedRecipeMetadataFactory,
  menuItemFormStateFactory,
  recipeDefinitionFactory,
  recipeMetadataFactory,
} from "@/testUtils/factories";
import { type RecipeDefinition } from "@/types/definitions";
import { uuidv4, validateRegistryId } from "@/types/helpers";
import { type IExtension } from "@/core";
import arrangeElements from "@/pageEditor/sidebar/arrangeElements";
import { type ActionFormState } from "@/pageEditor/extensionPoints/formStateTypes";

// Recipes
const ID_FOO = validateRegistryId("test/recipe-foo");
const recipeFoo: RecipeDefinition = recipeDefinitionFactory({
  metadata: recipeMetadataFactory({
    id: ID_FOO,
    name: "Foo Recipe",
  }),
});

const ID_BAR = validateRegistryId("test/recipe-bar");
const recipeBar: RecipeDefinition = recipeDefinitionFactory({
  metadata: recipeMetadataFactory({
    id: ID_BAR,
    name: "Bar Recipe",
  }),
});

// Extensions
const ID_FOO_A = uuidv4();
const installedFooA: IExtension = extensionFactory({
  id: ID_FOO_A,
  label: "A",
  _recipe: installedRecipeMetadataFactory({
    id: ID_FOO,
  }),
});

const ID_FOO_B = uuidv4();
const dynamicFooB: ActionFormState = menuItemFormStateFactory({
  uuid: ID_FOO_B,
  label: "B",
  recipe: installedRecipeMetadataFactory({
    id: ID_FOO,
  }),
});

const ID_ORPHAN_C = uuidv4();
const dynamicOrphanC: ActionFormState = menuItemFormStateFactory({
  uuid: ID_ORPHAN_C,
  label: "C",
});

const ID_BAR_D = uuidv4();
const installedBarD: IExtension = extensionFactory({
  id: ID_BAR_D,
  label: "D",
  _recipe: installedRecipeMetadataFactory({
    id: ID_BAR,
  }),
});

const ID_BAR_E = uuidv4();
const dynamicBarE: ActionFormState = menuItemFormStateFactory({
  uuid: ID_BAR_E,
  label: "E",
  recipe: installedRecipeMetadataFactory({
    id: ID_BAR,
  }),
});

const ID_BAR_F = uuidv4();
const installedBarF: IExtension = extensionFactory({
  id: ID_BAR_F,
  label: "F",
  _recipe: installedRecipeMetadataFactory({
    id: ID_BAR,
  }),
});

const ID_ORPHAN_G = uuidv4();
const installedOrphanG: IExtension = extensionFactory({
  id: ID_ORPHAN_G,
  label: "G",
});

const ID_ORPHAN_H = uuidv4();
const installedOrphanH: IExtension = extensionFactory({
  id: ID_ORPHAN_H,
  label: "H",
});

const dynamicOrphanH: ActionFormState = menuItemFormStateFactory({
  uuid: ID_ORPHAN_H,
  label: "H",
});

describe("arrangeElements()", () => {
  test("sort orphaned recipes by metadata.name", () => {
    const elements = arrangeElements({
      elements: [dynamicOrphanC],
      installed: [installedOrphanH, installedOrphanG],
      recipes: [],
      availableInstalledIds: [installedOrphanG.id, installedOrphanH.id],
      availableDynamicIds: [dynamicOrphanC.uuid],
      showAll: false,
      activeElementId: dynamicOrphanC.uuid,
      activeRecipeId: null,
      expandedRecipeId: null,
    });

    expect(elements).toStrictEqual([
      dynamicOrphanC,
      installedOrphanG,
      installedOrphanH,
    ]);
  });

  test("group recipes and sort properly", () => {
    const elements = arrangeElements({
      elements: [dynamicBarE, dynamicFooB],
      installed: [installedFooA, installedBarF, installedBarD],
      recipes: [recipeFoo, recipeBar],
      availableInstalledIds: [
        installedFooA.id,
        installedBarD.id,
        installedBarF.id,
      ],
      availableDynamicIds: [dynamicBarE.uuid, dynamicFooB.uuid],
      showAll: false,
      activeElementId: dynamicBarE.uuid,
      activeRecipeId: null,
      expandedRecipeId: null,
    });

    expect(elements).toEqual([
      [recipeBar.metadata.id, [installedBarD, dynamicBarE, installedBarF]],
      [recipeFoo.metadata.id, [installedFooA, dynamicFooB]],
    ]);
  });

  test("handle showAll flag properly", () => {
    const elements = arrangeElements({
      elements: [dynamicBarE],
      installed: [installedFooA, installedOrphanH],
      recipes: [recipeFoo, recipeBar],
      availableInstalledIds: [installedFooA.id],
      availableDynamicIds: [dynamicBarE.uuid],
      showAll: true,
      activeElementId: dynamicBarE.uuid,
      activeRecipeId: null,
      expandedRecipeId: null,
    });

    expect(elements).toStrictEqual([
      [recipeBar.metadata.id, [dynamicBarE]],
      [recipeFoo.metadata.id, [installedFooA]],
      installedOrphanH,
    ]);
  });

  test("keep active element when not available", () => {
    const elements = arrangeElements({
      elements: [dynamicOrphanC],
      installed: [],
      recipes: [],
      availableInstalledIds: [],
      availableDynamicIds: [],
      showAll: false,
      activeElementId: dynamicOrphanC.uuid,
      activeRecipeId: null,
      expandedRecipeId: null,
    });

    expect(elements).toStrictEqual([dynamicOrphanC]);
  });

  test("keep active recipe when elements not available", () => {
    const elements = arrangeElements({
      elements: [dynamicFooB, dynamicOrphanC],
      installed: [installedFooA],
      recipes: [recipeFoo],
      availableInstalledIds: [],
      availableDynamicIds: [ID_ORPHAN_C],
      showAll: false,
      activeElementId: null,
      activeRecipeId: ID_FOO,
      expandedRecipeId: null,
    });

    expect(elements).toStrictEqual([
      dynamicOrphanC,
      [recipeFoo.metadata.id, [installedFooA, dynamicFooB]],
    ]);
  });

  test("show element if its recipe is expanded", () => {
    const elements = arrangeElements({
      elements: [dynamicFooB],
      installed: [installedFooA],
      recipes: [recipeFoo],
      availableInstalledIds: [installedFooA.id],
      availableDynamicIds: [],
      showAll: false,
      activeElementId: dynamicOrphanC.uuid,
      activeRecipeId: null,
      expandedRecipeId: recipeFoo.metadata.id,
    });

    expect(elements).toStrictEqual([
      [recipeFoo.metadata.id, [installedFooA, dynamicFooB]],
    ]);
  });

  test("do not duplicate extension/element pairs in the results", () => {
    const elements = arrangeElements({
      elements: [dynamicOrphanH],
      installed: [installedOrphanH],
      recipes: [],
      availableInstalledIds: [installedOrphanH.id],
      availableDynamicIds: [dynamicOrphanH.uuid],
      showAll: false,
      activeElementId: ID_ORPHAN_H,
      activeRecipeId: null,
      expandedRecipeId: null,
    });

    expect(elements).toStrictEqual([dynamicOrphanH]);
  });
});
