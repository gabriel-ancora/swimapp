/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as athletes from "../athletes.js";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as cssTests from "../cssTests.js";
import type * as lib_session from "../lib/session.js";
import type * as passwords from "../passwords.js";
import type * as plans from "../plans.js";
import type * as qualifyingStandards from "../qualifyingStandards.js";
import type * as results from "../results.js";
import type * as rpeLogs from "../rpeLogs.js";
import type * as teams from "../teams.js";
import type * as wellness from "../wellness.js";
import type * as workouts from "../workouts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  athletes: typeof athletes;
  auth: typeof auth;
  catalog: typeof catalog;
  cssTests: typeof cssTests;
  "lib/session": typeof lib_session;
  passwords: typeof passwords;
  plans: typeof plans;
  qualifyingStandards: typeof qualifyingStandards;
  results: typeof results;
  rpeLogs: typeof rpeLogs;
  teams: typeof teams;
  wellness: typeof wellness;
  workouts: typeof workouts;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
