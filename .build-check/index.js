var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/tslib/tslib.es6.mjs
function __rest(s, e) {
  var t = {};
  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    t[p] = s[p];
  if (s != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        t[p[i]] = s[p[i]];
    }
  return t;
}
__name(__rest, "__rest");
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  __name(adopt, "adopt");
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    __name(fulfilled, "fulfilled");
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    __name(rejected, "rejected");
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    __name(step, "step");
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
__name(__awaiter, "__awaiter");

// node_modules/@supabase/functions-js/dist/module/helper.js
var resolveFetch = /* @__PURE__ */ __name((customFetch) => {
  if (customFetch) {
    return (...args) => customFetch(...args);
  }
  return (...args) => fetch(...args);
}, "resolveFetch");

// node_modules/@supabase/functions-js/dist/module/types.js
var FunctionsError = class extends Error {
  static {
    __name(this, "FunctionsError");
  }
  constructor(message2, name = "FunctionsError", context) {
    super(message2);
    this.name = name;
    this.context = context;
  }
};
var FunctionsFetchError = class extends FunctionsError {
  static {
    __name(this, "FunctionsFetchError");
  }
  constructor(context) {
    super("Failed to send a request to the Edge Function", "FunctionsFetchError", context);
  }
};
var FunctionsRelayError = class extends FunctionsError {
  static {
    __name(this, "FunctionsRelayError");
  }
  constructor(context) {
    super("Relay Error invoking the Edge Function", "FunctionsRelayError", context);
  }
};
var FunctionsHttpError = class extends FunctionsError {
  static {
    __name(this, "FunctionsHttpError");
  }
  constructor(context) {
    super("Edge Function returned a non-2xx status code", "FunctionsHttpError", context);
  }
};
var FunctionRegion;
(function(FunctionRegion2) {
  FunctionRegion2["Any"] = "any";
  FunctionRegion2["ApNortheast1"] = "ap-northeast-1";
  FunctionRegion2["ApNortheast2"] = "ap-northeast-2";
  FunctionRegion2["ApSouth1"] = "ap-south-1";
  FunctionRegion2["ApSoutheast1"] = "ap-southeast-1";
  FunctionRegion2["ApSoutheast2"] = "ap-southeast-2";
  FunctionRegion2["CaCentral1"] = "ca-central-1";
  FunctionRegion2["EuCentral1"] = "eu-central-1";
  FunctionRegion2["EuWest1"] = "eu-west-1";
  FunctionRegion2["EuWest2"] = "eu-west-2";
  FunctionRegion2["EuWest3"] = "eu-west-3";
  FunctionRegion2["SaEast1"] = "sa-east-1";
  FunctionRegion2["UsEast1"] = "us-east-1";
  FunctionRegion2["UsWest1"] = "us-west-1";
  FunctionRegion2["UsWest2"] = "us-west-2";
})(FunctionRegion || (FunctionRegion = {}));

// node_modules/@supabase/functions-js/dist/module/FunctionsClient.js
var FunctionsClient = class {
  static {
    __name(this, "FunctionsClient");
  }
  /**
   * Creates a new Functions client bound to an Edge Functions URL.
   *
   * @example
   * ```ts
   * import { FunctionsClient, FunctionRegion } from '@supabase/functions-js'
   *
   * const functions = new FunctionsClient('https://xyzcompany.supabase.co/functions/v1', {
   *   headers: { apikey: 'public-anon-key' },
   *   region: FunctionRegion.UsEast1,
   * })
   * ```
   */
  constructor(url, { headers = {}, customFetch, region = FunctionRegion.Any } = {}) {
    this.url = url;
    this.headers = headers;
    this.region = region;
    this.fetch = resolveFetch(customFetch);
  }
  /**
   * Updates the authorization header
   * @param token - the new jwt token sent in the authorisation header
   * @example
   * ```ts
   * functions.setAuth(session.access_token)
   * ```
   */
  setAuth(token) {
    this.headers.Authorization = `Bearer ${token}`;
  }
  /**
   * Invokes a function
   * @param functionName - The name of the Function to invoke.
   * @param options - Options for invoking the Function.
   * @example
   * ```ts
   * const { data, error } = await functions.invoke('hello-world', {
   *   body: { name: 'Ada' },
   * })
   * ```
   */
  invoke(functionName_1) {
    return __awaiter(this, arguments, void 0, function* (functionName, options = {}) {
      var _a;
      let timeoutId;
      let timeoutController;
      try {
        const { headers, method, body: functionArgs, signal, timeout } = options;
        let _headers = {};
        let { region } = options;
        if (!region) {
          region = this.region;
        }
        const url = new URL(`${this.url}/${functionName}`);
        if (region && region !== "any") {
          _headers["x-region"] = region;
          url.searchParams.set("forceFunctionRegion", region);
        }
        let body;
        if (functionArgs && (headers && !Object.prototype.hasOwnProperty.call(headers, "Content-Type") || !headers)) {
          if (typeof Blob !== "undefined" && functionArgs instanceof Blob || functionArgs instanceof ArrayBuffer) {
            _headers["Content-Type"] = "application/octet-stream";
            body = functionArgs;
          } else if (typeof functionArgs === "string") {
            _headers["Content-Type"] = "text/plain";
            body = functionArgs;
          } else if (typeof FormData !== "undefined" && functionArgs instanceof FormData) {
            body = functionArgs;
          } else {
            _headers["Content-Type"] = "application/json";
            body = JSON.stringify(functionArgs);
          }
        } else {
          if (functionArgs && typeof functionArgs !== "string" && !(typeof Blob !== "undefined" && functionArgs instanceof Blob) && !(functionArgs instanceof ArrayBuffer) && !(typeof FormData !== "undefined" && functionArgs instanceof FormData)) {
            body = JSON.stringify(functionArgs);
          } else {
            body = functionArgs;
          }
        }
        let effectiveSignal = signal;
        if (timeout) {
          timeoutController = new AbortController();
          timeoutId = setTimeout(() => timeoutController.abort(), timeout);
          if (signal) {
            effectiveSignal = timeoutController.signal;
            signal.addEventListener("abort", () => timeoutController.abort());
          } else {
            effectiveSignal = timeoutController.signal;
          }
        }
        const response = yield this.fetch(url.toString(), {
          method: method || "POST",
          // headers priority is (high to low):
          // 1. invoke-level headers
          // 2. client-level headers
          // 3. default Content-Type header
          headers: Object.assign(Object.assign(Object.assign({}, _headers), this.headers), headers),
          body,
          signal: effectiveSignal
        }).catch((fetchError) => {
          throw new FunctionsFetchError(fetchError);
        });
        const isRelayError = response.headers.get("x-relay-error");
        if (isRelayError && isRelayError === "true") {
          throw new FunctionsRelayError(response);
        }
        if (!response.ok) {
          throw new FunctionsHttpError(response);
        }
        let responseType = ((_a = response.headers.get("Content-Type")) !== null && _a !== void 0 ? _a : "text/plain").split(";")[0].trim();
        let data;
        if (responseType === "application/json") {
          data = yield response.json();
        } else if (responseType === "application/octet-stream" || responseType === "application/pdf") {
          data = yield response.blob();
        } else if (responseType === "text/event-stream") {
          data = response;
        } else if (responseType === "multipart/form-data") {
          data = yield response.formData();
        } else {
          data = yield response.text();
        }
        return { data, error: null, response };
      } catch (error) {
        return {
          data: null,
          error,
          response: error instanceof FunctionsHttpError || error instanceof FunctionsRelayError ? error.context : void 0
        };
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    });
  }
};

// node_modules/@supabase/postgrest-js/dist/index.mjs
var PostgrestError = class extends Error {
  static {
    __name(this, "PostgrestError");
  }
  /**
  * @example
  * ```ts
  * import PostgrestError from '@supabase/postgrest-js'
  *
  * throw new PostgrestError({
  *   message: 'Row level security prevented the request',
  *   details: 'RLS denied the insert',
  *   hint: 'Check your policies',
  *   code: 'PGRST301',
  * })
  * ```
  */
  constructor(context) {
    super(context.message);
    this.name = "PostgrestError";
    this.details = context.details;
    this.hint = context.hint;
    this.code = context.code;
  }
};
var PostgrestBuilder = class {
  static {
    __name(this, "PostgrestBuilder");
  }
  /**
  * Creates a builder configured for a specific PostgREST request.
  *
  * @example
  * ```ts
  * import PostgrestQueryBuilder from '@supabase/postgrest-js'
  *
  * const builder = new PostgrestQueryBuilder(
  *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
  *   { headers: new Headers({ apikey: 'public-anon-key' }) }
  * )
  * ```
  */
  constructor(builder) {
    var _builder$shouldThrowO, _builder$isMaybeSingl, _builder$urlLengthLim;
    this.shouldThrowOnError = false;
    this.method = builder.method;
    this.url = builder.url;
    this.headers = new Headers(builder.headers);
    this.schema = builder.schema;
    this.body = builder.body;
    this.shouldThrowOnError = (_builder$shouldThrowO = builder.shouldThrowOnError) !== null && _builder$shouldThrowO !== void 0 ? _builder$shouldThrowO : false;
    this.signal = builder.signal;
    this.isMaybeSingle = (_builder$isMaybeSingl = builder.isMaybeSingle) !== null && _builder$isMaybeSingl !== void 0 ? _builder$isMaybeSingl : false;
    this.urlLengthLimit = (_builder$urlLengthLim = builder.urlLengthLimit) !== null && _builder$urlLengthLim !== void 0 ? _builder$urlLengthLim : 8e3;
    if (builder.fetch) this.fetch = builder.fetch;
    else this.fetch = fetch;
  }
  /**
  * If there's an error with the query, throwOnError will reject the promise by
  * throwing the error instead of returning it as part of a successful response.
  *
  * {@link https://github.com/supabase/supabase-js/issues/92}
  */
  throwOnError() {
    this.shouldThrowOnError = true;
    return this;
  }
  /**
  * Set an HTTP header for the request.
  */
  setHeader(name, value) {
    this.headers = new Headers(this.headers);
    this.headers.set(name, value);
    return this;
  }
  then(onfulfilled, onrejected) {
    var _this = this;
    if (this.schema === void 0) {
    } else if (["GET", "HEAD"].includes(this.method)) this.headers.set("Accept-Profile", this.schema);
    else this.headers.set("Content-Profile", this.schema);
    if (this.method !== "GET" && this.method !== "HEAD") this.headers.set("Content-Type", "application/json");
    const _fetch = this.fetch;
    let res = _fetch(this.url.toString(), {
      method: this.method,
      headers: this.headers,
      body: JSON.stringify(this.body),
      signal: this.signal
    }).then(async (res$1) => {
      let error = null;
      let data = null;
      let count = null;
      let status = res$1.status;
      let statusText = res$1.statusText;
      if (res$1.ok) {
        var _this$headers$get2, _res$headers$get;
        if (_this.method !== "HEAD") {
          var _this$headers$get;
          const body = await res$1.text();
          if (body === "") {
          } else if (_this.headers.get("Accept") === "text/csv") data = body;
          else if (_this.headers.get("Accept") && ((_this$headers$get = _this.headers.get("Accept")) === null || _this$headers$get === void 0 ? void 0 : _this$headers$get.includes("application/vnd.pgrst.plan+text"))) data = body;
          else data = JSON.parse(body);
        }
        const countHeader = (_this$headers$get2 = _this.headers.get("Prefer")) === null || _this$headers$get2 === void 0 ? void 0 : _this$headers$get2.match(/count=(exact|planned|estimated)/);
        const contentRange = (_res$headers$get = res$1.headers.get("content-range")) === null || _res$headers$get === void 0 ? void 0 : _res$headers$get.split("/");
        if (countHeader && contentRange && contentRange.length > 1) count = parseInt(contentRange[1]);
        if (_this.isMaybeSingle && _this.method === "GET" && Array.isArray(data)) if (data.length > 1) {
          error = {
            code: "PGRST116",
            details: `Results contain ${data.length} rows, application/vnd.pgrst.object+json requires 1 row`,
            hint: null,
            message: "JSON object requested, multiple (or no) rows returned"
          };
          data = null;
          count = null;
          status = 406;
          statusText = "Not Acceptable";
        } else if (data.length === 1) data = data[0];
        else data = null;
      } else {
        var _error$details;
        const body = await res$1.text();
        try {
          error = JSON.parse(body);
          if (Array.isArray(error) && res$1.status === 404) {
            data = [];
            error = null;
            status = 200;
            statusText = "OK";
          }
        } catch (_unused) {
          if (res$1.status === 404 && body === "") {
            status = 204;
            statusText = "No Content";
          } else error = { message: body };
        }
        if (error && _this.isMaybeSingle && (error === null || error === void 0 || (_error$details = error.details) === null || _error$details === void 0 ? void 0 : _error$details.includes("0 rows"))) {
          error = null;
          status = 200;
          statusText = "OK";
        }
        if (error && _this.shouldThrowOnError) throw new PostgrestError(error);
      }
      return {
        error,
        data,
        count,
        status,
        statusText
      };
    });
    if (!this.shouldThrowOnError) res = res.catch((fetchError) => {
      var _fetchError$name2;
      let errorDetails = "";
      let hint = "";
      let code = "";
      const cause = fetchError === null || fetchError === void 0 ? void 0 : fetchError.cause;
      if (cause) {
        var _cause$message, _cause$code, _fetchError$name, _cause$name;
        const causeMessage = (_cause$message = cause === null || cause === void 0 ? void 0 : cause.message) !== null && _cause$message !== void 0 ? _cause$message : "";
        const causeCode = (_cause$code = cause === null || cause === void 0 ? void 0 : cause.code) !== null && _cause$code !== void 0 ? _cause$code : "";
        errorDetails = `${(_fetchError$name = fetchError === null || fetchError === void 0 ? void 0 : fetchError.name) !== null && _fetchError$name !== void 0 ? _fetchError$name : "FetchError"}: ${fetchError === null || fetchError === void 0 ? void 0 : fetchError.message}`;
        errorDetails += `

Caused by: ${(_cause$name = cause === null || cause === void 0 ? void 0 : cause.name) !== null && _cause$name !== void 0 ? _cause$name : "Error"}: ${causeMessage}`;
        if (causeCode) errorDetails += ` (${causeCode})`;
        if (cause === null || cause === void 0 ? void 0 : cause.stack) errorDetails += `
${cause.stack}`;
      } else {
        var _fetchError$stack;
        errorDetails = (_fetchError$stack = fetchError === null || fetchError === void 0 ? void 0 : fetchError.stack) !== null && _fetchError$stack !== void 0 ? _fetchError$stack : "";
      }
      const urlLength = this.url.toString().length;
      if ((fetchError === null || fetchError === void 0 ? void 0 : fetchError.name) === "AbortError" || (fetchError === null || fetchError === void 0 ? void 0 : fetchError.code) === "ABORT_ERR") {
        code = "";
        hint = "Request was aborted (timeout or manual cancellation)";
        if (urlLength > this.urlLengthLimit) hint += `. Note: Your request URL is ${urlLength} characters, which may exceed server limits. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [many IDs])), consider using an RPC function to pass values server-side.`;
      } else if ((cause === null || cause === void 0 ? void 0 : cause.name) === "HeadersOverflowError" || (cause === null || cause === void 0 ? void 0 : cause.code) === "UND_ERR_HEADERS_OVERFLOW") {
        code = "";
        hint = "HTTP headers exceeded server limits (typically 16KB)";
        if (urlLength > this.urlLengthLimit) hint += `. Your request URL is ${urlLength} characters. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [200+ IDs])), consider using an RPC function instead.`;
      }
      return {
        error: {
          message: `${(_fetchError$name2 = fetchError === null || fetchError === void 0 ? void 0 : fetchError.name) !== null && _fetchError$name2 !== void 0 ? _fetchError$name2 : "FetchError"}: ${fetchError === null || fetchError === void 0 ? void 0 : fetchError.message}`,
          details: errorDetails,
          hint,
          code
        },
        data: null,
        count: null,
        status: 0,
        statusText: ""
      };
    });
    return res.then(onfulfilled, onrejected);
  }
  /**
  * Override the type of the returned `data`.
  *
  * @typeParam NewResult - The new result type to override with
  * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
  */
  returns() {
    return this;
  }
  /**
  * Override the type of the returned `data` field in the response.
  *
  * @typeParam NewResult - The new type to cast the response data to
  * @typeParam Options - Optional type configuration (defaults to { merge: true })
  * @typeParam Options.merge - When true, merges the new type with existing return type. When false, replaces the existing types entirely (defaults to true)
  * @example
  * ```typescript
  * // Merge with existing types (default behavior)
  * const query = supabase
  *   .from('users')
  *   .select()
  *   .overrideTypes<{ custom_field: string }>()
  *
  * // Replace existing types completely
  * const replaceQuery = supabase
  *   .from('users')
  *   .select()
  *   .overrideTypes<{ id: number; name: string }, { merge: false }>()
  * ```
  * @returns A PostgrestBuilder instance with the new type
  */
  overrideTypes() {
    return this;
  }
};
var PostgrestTransformBuilder = class extends PostgrestBuilder {
  static {
    __name(this, "PostgrestTransformBuilder");
  }
  /**
  * Perform a SELECT on the query result.
  *
  * By default, `.insert()`, `.update()`, `.upsert()`, and `.delete()` do not
  * return modified rows. By calling this method, modified rows are returned in
  * `data`.
  *
  * @param columns - The columns to retrieve, separated by commas
  */
  select(columns) {
    let quoted = false;
    const cleanedColumns = (columns !== null && columns !== void 0 ? columns : "*").split("").map((c) => {
      if (/\s/.test(c) && !quoted) return "";
      if (c === '"') quoted = !quoted;
      return c;
    }).join("");
    this.url.searchParams.set("select", cleanedColumns);
    this.headers.append("Prefer", "return=representation");
    return this;
  }
  /**
  * Order the query result by `column`.
  *
  * You can call this method multiple times to order by multiple columns.
  *
  * You can order referenced tables, but it only affects the ordering of the
  * parent table if you use `!inner` in the query.
  *
  * @param column - The column to order by
  * @param options - Named parameters
  * @param options.ascending - If `true`, the result will be in ascending order
  * @param options.nullsFirst - If `true`, `null`s appear first. If `false`,
  * `null`s appear last.
  * @param options.referencedTable - Set this to order a referenced table by
  * its columns
  * @param options.foreignTable - Deprecated, use `options.referencedTable`
  * instead
  */
  order(column, { ascending = true, nullsFirst, foreignTable, referencedTable = foreignTable } = {}) {
    const key = referencedTable ? `${referencedTable}.order` : "order";
    const existingOrder = this.url.searchParams.get(key);
    this.url.searchParams.set(key, `${existingOrder ? `${existingOrder},` : ""}${column}.${ascending ? "asc" : "desc"}${nullsFirst === void 0 ? "" : nullsFirst ? ".nullsfirst" : ".nullslast"}`);
    return this;
  }
  /**
  * Limit the query result by `count`.
  *
  * @param count - The maximum number of rows to return
  * @param options - Named parameters
  * @param options.referencedTable - Set this to limit rows of referenced
  * tables instead of the parent table
  * @param options.foreignTable - Deprecated, use `options.referencedTable`
  * instead
  */
  limit(count, { foreignTable, referencedTable = foreignTable } = {}) {
    const key = typeof referencedTable === "undefined" ? "limit" : `${referencedTable}.limit`;
    this.url.searchParams.set(key, `${count}`);
    return this;
  }
  /**
  * Limit the query result by starting at an offset `from` and ending at the offset `to`.
  * Only records within this range are returned.
  * This respects the query order and if there is no order clause the range could behave unexpectedly.
  * The `from` and `to` values are 0-based and inclusive: `range(1, 3)` will include the second, third
  * and fourth rows of the query.
  *
  * @param from - The starting index from which to limit the result
  * @param to - The last index to which to limit the result
  * @param options - Named parameters
  * @param options.referencedTable - Set this to limit rows of referenced
  * tables instead of the parent table
  * @param options.foreignTable - Deprecated, use `options.referencedTable`
  * instead
  */
  range(from, to, { foreignTable, referencedTable = foreignTable } = {}) {
    const keyOffset = typeof referencedTable === "undefined" ? "offset" : `${referencedTable}.offset`;
    const keyLimit = typeof referencedTable === "undefined" ? "limit" : `${referencedTable}.limit`;
    this.url.searchParams.set(keyOffset, `${from}`);
    this.url.searchParams.set(keyLimit, `${to - from + 1}`);
    return this;
  }
  /**
  * Set the AbortSignal for the fetch request.
  *
  * @param signal - The AbortSignal to use for the fetch request
  */
  abortSignal(signal) {
    this.signal = signal;
    return this;
  }
  /**
  * Return `data` as a single object instead of an array of objects.
  *
  * Query result must be one row (e.g. using `.limit(1)`), otherwise this
  * returns an error.
  */
  single() {
    this.headers.set("Accept", "application/vnd.pgrst.object+json");
    return this;
  }
  /**
  * Return `data` as a single object instead of an array of objects.
  *
  * Query result must be zero or one row (e.g. using `.limit(1)`), otherwise
  * this returns an error.
  */
  maybeSingle() {
    if (this.method === "GET") this.headers.set("Accept", "application/json");
    else this.headers.set("Accept", "application/vnd.pgrst.object+json");
    this.isMaybeSingle = true;
    return this;
  }
  /**
  * Return `data` as a string in CSV format.
  */
  csv() {
    this.headers.set("Accept", "text/csv");
    return this;
  }
  /**
  * Return `data` as an object in [GeoJSON](https://geojson.org) format.
  */
  geojson() {
    this.headers.set("Accept", "application/geo+json");
    return this;
  }
  /**
  * Return `data` as the EXPLAIN plan for the query.
  *
  * You need to enable the
  * [db_plan_enabled](https://supabase.com/docs/guides/database/debugging-performance#enabling-explain)
  * setting before using this method.
  *
  * @param options - Named parameters
  *
  * @param options.analyze - If `true`, the query will be executed and the
  * actual run time will be returned
  *
  * @param options.verbose - If `true`, the query identifier will be returned
  * and `data` will include the output columns of the query
  *
  * @param options.settings - If `true`, include information on configuration
  * parameters that affect query planning
  *
  * @param options.buffers - If `true`, include information on buffer usage
  *
  * @param options.wal - If `true`, include information on WAL record generation
  *
  * @param options.format - The format of the output, can be `"text"` (default)
  * or `"json"`
  */
  explain({ analyze = false, verbose = false, settings = false, buffers = false, wal = false, format = "text" } = {}) {
    var _this$headers$get;
    const options = [
      analyze ? "analyze" : null,
      verbose ? "verbose" : null,
      settings ? "settings" : null,
      buffers ? "buffers" : null,
      wal ? "wal" : null
    ].filter(Boolean).join("|");
    const forMediatype = (_this$headers$get = this.headers.get("Accept")) !== null && _this$headers$get !== void 0 ? _this$headers$get : "application/json";
    this.headers.set("Accept", `application/vnd.pgrst.plan+${format}; for="${forMediatype}"; options=${options};`);
    if (format === "json") return this;
    else return this;
  }
  /**
  * Rollback the query.
  *
  * `data` will still be returned, but the query is not committed.
  */
  rollback() {
    this.headers.append("Prefer", "tx=rollback");
    return this;
  }
  /**
  * Override the type of the returned `data`.
  *
  * @typeParam NewResult - The new result type to override with
  * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
  */
  returns() {
    return this;
  }
  /**
  * Set the maximum number of rows that can be affected by the query.
  * Only available in PostgREST v13+ and only works with PATCH and DELETE methods.
  *
  * @param value - The maximum number of rows that can be affected
  */
  maxAffected(value) {
    this.headers.append("Prefer", "handling=strict");
    this.headers.append("Prefer", `max-affected=${value}`);
    return this;
  }
};
var PostgrestReservedCharsRegexp = /* @__PURE__ */ new RegExp("[,()]");
var PostgrestFilterBuilder = class extends PostgrestTransformBuilder {
  static {
    __name(this, "PostgrestFilterBuilder");
  }
  /**
  * Match only rows where `column` is equal to `value`.
  *
  * To check if the value of `column` is NULL, you should use `.is()` instead.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  eq(column, value) {
    this.url.searchParams.append(column, `eq.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` is not equal to `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  neq(column, value) {
    this.url.searchParams.append(column, `neq.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` is greater than `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  gt(column, value) {
    this.url.searchParams.append(column, `gt.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` is greater than or equal to `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  gte(column, value) {
    this.url.searchParams.append(column, `gte.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` is less than `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  lt(column, value) {
    this.url.searchParams.append(column, `lt.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` is less than or equal to `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  lte(column, value) {
    this.url.searchParams.append(column, `lte.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` matches `pattern` case-sensitively.
  *
  * @param column - The column to filter on
  * @param pattern - The pattern to match with
  */
  like(column, pattern) {
    this.url.searchParams.append(column, `like.${pattern}`);
    return this;
  }
  /**
  * Match only rows where `column` matches all of `patterns` case-sensitively.
  *
  * @param column - The column to filter on
  * @param patterns - The patterns to match with
  */
  likeAllOf(column, patterns) {
    this.url.searchParams.append(column, `like(all).{${patterns.join(",")}}`);
    return this;
  }
  /**
  * Match only rows where `column` matches any of `patterns` case-sensitively.
  *
  * @param column - The column to filter on
  * @param patterns - The patterns to match with
  */
  likeAnyOf(column, patterns) {
    this.url.searchParams.append(column, `like(any).{${patterns.join(",")}}`);
    return this;
  }
  /**
  * Match only rows where `column` matches `pattern` case-insensitively.
  *
  * @param column - The column to filter on
  * @param pattern - The pattern to match with
  */
  ilike(column, pattern) {
    this.url.searchParams.append(column, `ilike.${pattern}`);
    return this;
  }
  /**
  * Match only rows where `column` matches all of `patterns` case-insensitively.
  *
  * @param column - The column to filter on
  * @param patterns - The patterns to match with
  */
  ilikeAllOf(column, patterns) {
    this.url.searchParams.append(column, `ilike(all).{${patterns.join(",")}}`);
    return this;
  }
  /**
  * Match only rows where `column` matches any of `patterns` case-insensitively.
  *
  * @param column - The column to filter on
  * @param patterns - The patterns to match with
  */
  ilikeAnyOf(column, patterns) {
    this.url.searchParams.append(column, `ilike(any).{${patterns.join(",")}}`);
    return this;
  }
  /**
  * Match only rows where `column` matches the PostgreSQL regex `pattern`
  * case-sensitively (using the `~` operator).
  *
  * @param column - The column to filter on
  * @param pattern - The PostgreSQL regular expression pattern to match with
  */
  regexMatch(column, pattern) {
    this.url.searchParams.append(column, `match.${pattern}`);
    return this;
  }
  /**
  * Match only rows where `column` matches the PostgreSQL regex `pattern`
  * case-insensitively (using the `~*` operator).
  *
  * @param column - The column to filter on
  * @param pattern - The PostgreSQL regular expression pattern to match with
  */
  regexIMatch(column, pattern) {
    this.url.searchParams.append(column, `imatch.${pattern}`);
    return this;
  }
  /**
  * Match only rows where `column` IS `value`.
  *
  * For non-boolean columns, this is only relevant for checking if the value of
  * `column` is NULL by setting `value` to `null`.
  *
  * For boolean columns, you can also set `value` to `true` or `false` and it
  * will behave the same way as `.eq()`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  is(column, value) {
    this.url.searchParams.append(column, `is.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` IS DISTINCT FROM `value`.
  *
  * Unlike `.neq()`, this treats `NULL` as a comparable value. Two `NULL` values
  * are considered equal (not distinct), and comparing `NULL` with any non-NULL
  * value returns true (distinct).
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  isDistinct(column, value) {
    this.url.searchParams.append(column, `isdistinct.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` is included in the `values` array.
  *
  * @param column - The column to filter on
  * @param values - The values array to filter with
  */
  in(column, values) {
    const cleanedValues = Array.from(new Set(values)).map((s) => {
      if (typeof s === "string" && PostgrestReservedCharsRegexp.test(s)) return `"${s}"`;
      else return `${s}`;
    }).join(",");
    this.url.searchParams.append(column, `in.(${cleanedValues})`);
    return this;
  }
  /**
  * Match only rows where `column` is NOT included in the `values` array.
  *
  * @param column - The column to filter on
  * @param values - The values array to filter with
  */
  notIn(column, values) {
    const cleanedValues = Array.from(new Set(values)).map((s) => {
      if (typeof s === "string" && PostgrestReservedCharsRegexp.test(s)) return `"${s}"`;
      else return `${s}`;
    }).join(",");
    this.url.searchParams.append(column, `not.in.(${cleanedValues})`);
    return this;
  }
  /**
  * Only relevant for jsonb, array, and range columns. Match only rows where
  * `column` contains every element appearing in `value`.
  *
  * @param column - The jsonb, array, or range column to filter on
  * @param value - The jsonb, array, or range value to filter with
  */
  contains(column, value) {
    if (typeof value === "string") this.url.searchParams.append(column, `cs.${value}`);
    else if (Array.isArray(value)) this.url.searchParams.append(column, `cs.{${value.join(",")}}`);
    else this.url.searchParams.append(column, `cs.${JSON.stringify(value)}`);
    return this;
  }
  /**
  * Only relevant for jsonb, array, and range columns. Match only rows where
  * every element appearing in `column` is contained by `value`.
  *
  * @param column - The jsonb, array, or range column to filter on
  * @param value - The jsonb, array, or range value to filter with
  */
  containedBy(column, value) {
    if (typeof value === "string") this.url.searchParams.append(column, `cd.${value}`);
    else if (Array.isArray(value)) this.url.searchParams.append(column, `cd.{${value.join(",")}}`);
    else this.url.searchParams.append(column, `cd.${JSON.stringify(value)}`);
    return this;
  }
  /**
  * Only relevant for range columns. Match only rows where every element in
  * `column` is greater than any element in `range`.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  */
  rangeGt(column, range) {
    this.url.searchParams.append(column, `sr.${range}`);
    return this;
  }
  /**
  * Only relevant for range columns. Match only rows where every element in
  * `column` is either contained in `range` or greater than any element in
  * `range`.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  */
  rangeGte(column, range) {
    this.url.searchParams.append(column, `nxl.${range}`);
    return this;
  }
  /**
  * Only relevant for range columns. Match only rows where every element in
  * `column` is less than any element in `range`.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  */
  rangeLt(column, range) {
    this.url.searchParams.append(column, `sl.${range}`);
    return this;
  }
  /**
  * Only relevant for range columns. Match only rows where every element in
  * `column` is either contained in `range` or less than any element in
  * `range`.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  */
  rangeLte(column, range) {
    this.url.searchParams.append(column, `nxr.${range}`);
    return this;
  }
  /**
  * Only relevant for range columns. Match only rows where `column` is
  * mutually exclusive to `range` and there can be no element between the two
  * ranges.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  */
  rangeAdjacent(column, range) {
    this.url.searchParams.append(column, `adj.${range}`);
    return this;
  }
  /**
  * Only relevant for array and range columns. Match only rows where
  * `column` and `value` have an element in common.
  *
  * @param column - The array or range column to filter on
  * @param value - The array or range value to filter with
  */
  overlaps(column, value) {
    if (typeof value === "string") this.url.searchParams.append(column, `ov.${value}`);
    else this.url.searchParams.append(column, `ov.{${value.join(",")}}`);
    return this;
  }
  /**
  * Only relevant for text and tsvector columns. Match only rows where
  * `column` matches the query string in `query`.
  *
  * @param column - The text or tsvector column to filter on
  * @param query - The query text to match with
  * @param options - Named parameters
  * @param options.config - The text search configuration to use
  * @param options.type - Change how the `query` text is interpreted
  */
  textSearch(column, query, { config, type } = {}) {
    let typePart = "";
    if (type === "plain") typePart = "pl";
    else if (type === "phrase") typePart = "ph";
    else if (type === "websearch") typePart = "w";
    const configPart = config === void 0 ? "" : `(${config})`;
    this.url.searchParams.append(column, `${typePart}fts${configPart}.${query}`);
    return this;
  }
  /**
  * Match only rows where each column in `query` keys is equal to its
  * associated value. Shorthand for multiple `.eq()`s.
  *
  * @param query - The object to filter with, with column names as keys mapped
  * to their filter values
  */
  match(query) {
    Object.entries(query).forEach(([column, value]) => {
      this.url.searchParams.append(column, `eq.${value}`);
    });
    return this;
  }
  /**
  * Match only rows which doesn't satisfy the filter.
  *
  * Unlike most filters, `opearator` and `value` are used as-is and need to
  * follow [PostgREST
  * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
  * to make sure they are properly sanitized.
  *
  * @param column - The column to filter on
  * @param operator - The operator to be negated to filter with, following
  * PostgREST syntax
  * @param value - The value to filter with, following PostgREST syntax
  */
  not(column, operator, value) {
    this.url.searchParams.append(column, `not.${operator}.${value}`);
    return this;
  }
  /**
  * Match only rows which satisfy at least one of the filters.
  *
  * Unlike most filters, `filters` is used as-is and needs to follow [PostgREST
  * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
  * to make sure it's properly sanitized.
  *
  * It's currently not possible to do an `.or()` filter across multiple tables.
  *
  * @param filters - The filters to use, following PostgREST syntax
  * @param options - Named parameters
  * @param options.referencedTable - Set this to filter on referenced tables
  * instead of the parent table
  * @param options.foreignTable - Deprecated, use `referencedTable` instead
  */
  or(filters, { foreignTable, referencedTable = foreignTable } = {}) {
    const key = referencedTable ? `${referencedTable}.or` : "or";
    this.url.searchParams.append(key, `(${filters})`);
    return this;
  }
  /**
  * Match only rows which satisfy the filter. This is an escape hatch - you
  * should use the specific filter methods wherever possible.
  *
  * Unlike most filters, `opearator` and `value` are used as-is and need to
  * follow [PostgREST
  * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
  * to make sure they are properly sanitized.
  *
  * @param column - The column to filter on
  * @param operator - The operator to filter with, following PostgREST syntax
  * @param value - The value to filter with, following PostgREST syntax
  */
  filter(column, operator, value) {
    this.url.searchParams.append(column, `${operator}.${value}`);
    return this;
  }
};
var PostgrestQueryBuilder = class {
  static {
    __name(this, "PostgrestQueryBuilder");
  }
  /**
  * Creates a query builder scoped to a Postgres table or view.
  *
  * @example
  * ```ts
  * import PostgrestQueryBuilder from '@supabase/postgrest-js'
  *
  * const query = new PostgrestQueryBuilder(
  *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
  *   { headers: { apikey: 'public-anon-key' } }
  * )
  * ```
  */
  constructor(url, { headers = {}, schema, fetch: fetch$1, urlLengthLimit = 8e3 }) {
    this.url = url;
    this.headers = new Headers(headers);
    this.schema = schema;
    this.fetch = fetch$1;
    this.urlLengthLimit = urlLengthLimit;
  }
  /**
  * Clone URL and headers to prevent shared state between operations.
  */
  cloneRequestState() {
    return {
      url: new URL(this.url.toString()),
      headers: new Headers(this.headers)
    };
  }
  /**
  * Perform a SELECT query on the table or view.
  *
  * @param columns - The columns to retrieve, separated by commas. Columns can be renamed when returned with `customName:columnName`
  *
  * @param options - Named parameters
  *
  * @param options.head - When set to `true`, `data` will not be returned.
  * Useful if you only need the count.
  *
  * @param options.count - Count algorithm to use to count rows in the table or view.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @remarks
  * When using `count` with `.range()` or `.limit()`, the returned `count` is the total number of rows
  * that match your filters, not the number of rows in the current page. Use this to build pagination UI.
  */
  select(columns, options) {
    const { head: head2 = false, count } = options !== null && options !== void 0 ? options : {};
    const method = head2 ? "HEAD" : "GET";
    let quoted = false;
    const cleanedColumns = (columns !== null && columns !== void 0 ? columns : "*").split("").map((c) => {
      if (/\s/.test(c) && !quoted) return "";
      if (c === '"') quoted = !quoted;
      return c;
    }).join("");
    const { url, headers } = this.cloneRequestState();
    url.searchParams.set("select", cleanedColumns);
    if (count) headers.append("Prefer", `count=${count}`);
    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
  /**
  * Perform an INSERT into the table or view.
  *
  * By default, inserted rows are not returned. To return it, chain the call
  * with `.select()`.
  *
  * @param values - The values to insert. Pass an object to insert a single row
  * or an array to insert multiple rows.
  *
  * @param options - Named parameters
  *
  * @param options.count - Count algorithm to use to count inserted rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @param options.defaultToNull - Make missing fields default to `null`.
  * Otherwise, use the default value for the column. Only applies for bulk
  * inserts.
  */
  insert(values, { count, defaultToNull = true } = {}) {
    var _this$fetch;
    const method = "POST";
    const { url, headers } = this.cloneRequestState();
    if (count) headers.append("Prefer", `count=${count}`);
    if (!defaultToNull) headers.append("Prefer", `missing=default`);
    if (Array.isArray(values)) {
      const columns = values.reduce((acc, x) => acc.concat(Object.keys(x)), []);
      if (columns.length > 0) {
        const uniqueColumns = [...new Set(columns)].map((column) => `"${column}"`);
        url.searchParams.set("columns", uniqueColumns.join(","));
      }
    }
    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      body: values,
      fetch: (_this$fetch = this.fetch) !== null && _this$fetch !== void 0 ? _this$fetch : fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
  /**
  * Perform an UPSERT on the table or view. Depending on the column(s) passed
  * to `onConflict`, `.upsert()` allows you to perform the equivalent of
  * `.insert()` if a row with the corresponding `onConflict` columns doesn't
  * exist, or if it does exist, perform an alternative action depending on
  * `ignoreDuplicates`.
  *
  * By default, upserted rows are not returned. To return it, chain the call
  * with `.select()`.
  *
  * @param values - The values to upsert with. Pass an object to upsert a
  * single row or an array to upsert multiple rows.
  *
  * @param options - Named parameters
  *
  * @param options.onConflict - Comma-separated UNIQUE column(s) to specify how
  * duplicate rows are determined. Two rows are duplicates if all the
  * `onConflict` columns are equal.
  *
  * @param options.ignoreDuplicates - If `true`, duplicate rows are ignored. If
  * `false`, duplicate rows are merged with existing rows.
  *
  * @param options.count - Count algorithm to use to count upserted rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @param options.defaultToNull - Make missing fields default to `null`.
  * Otherwise, use the default value for the column. This only applies when
  * inserting new rows, not when merging with existing rows under
  * `ignoreDuplicates: false`. This also only applies when doing bulk upserts.
  *
  * @example Upsert a single row using a unique key
  * ```ts
  * // Upserting a single row, overwriting based on the 'username' unique column
  * const { data, error } = await supabase
  *   .from('users')
  *   .upsert({ username: 'supabot' }, { onConflict: 'username' })
  *
  * // Example response:
  * // {
  * //   data: [
  * //     { id: 4, message: 'bar', username: 'supabot' }
  * //   ],
  * //   error: null
  * // }
  * ```
  *
  * @example Upsert with conflict resolution and exact row counting
  * ```ts
  * // Upserting and returning exact count
  * const { data, error, count } = await supabase
  *   .from('users')
  *   .upsert(
  *     {
  *       id: 3,
  *       message: 'foo',
  *       username: 'supabot'
  *     },
  *     {
  *       onConflict: 'username',
  *       count: 'exact'
  *     }
  *   )
  *
  * // Example response:
  * // {
  * //   data: [
  * //     {
  * //       id: 42,
  * //       handle: "saoirse",
  * //       display_name: "Saoirse"
  * //     }
  * //   ],
  * //   count: 1,
  * //   error: null
  * // }
  * ```
  */
  upsert(values, { onConflict, ignoreDuplicates = false, count, defaultToNull = true } = {}) {
    var _this$fetch2;
    const method = "POST";
    const { url, headers } = this.cloneRequestState();
    headers.append("Prefer", `resolution=${ignoreDuplicates ? "ignore" : "merge"}-duplicates`);
    if (onConflict !== void 0) url.searchParams.set("on_conflict", onConflict);
    if (count) headers.append("Prefer", `count=${count}`);
    if (!defaultToNull) headers.append("Prefer", "missing=default");
    if (Array.isArray(values)) {
      const columns = values.reduce((acc, x) => acc.concat(Object.keys(x)), []);
      if (columns.length > 0) {
        const uniqueColumns = [...new Set(columns)].map((column) => `"${column}"`);
        url.searchParams.set("columns", uniqueColumns.join(","));
      }
    }
    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      body: values,
      fetch: (_this$fetch2 = this.fetch) !== null && _this$fetch2 !== void 0 ? _this$fetch2 : fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
  /**
  * Perform an UPDATE on the table or view.
  *
  * By default, updated rows are not returned. To return it, chain the call
  * with `.select()` after filters.
  *
  * @param values - The values to update with
  *
  * @param options - Named parameters
  *
  * @param options.count - Count algorithm to use to count updated rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  */
  update(values, { count } = {}) {
    var _this$fetch3;
    const method = "PATCH";
    const { url, headers } = this.cloneRequestState();
    if (count) headers.append("Prefer", `count=${count}`);
    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      body: values,
      fetch: (_this$fetch3 = this.fetch) !== null && _this$fetch3 !== void 0 ? _this$fetch3 : fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
  /**
  * Perform a DELETE on the table or view.
  *
  * By default, deleted rows are not returned. To return it, chain the call
  * with `.select()` after filters.
  *
  * @param options - Named parameters
  *
  * @param options.count - Count algorithm to use to count deleted rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  */
  delete({ count } = {}) {
    var _this$fetch4;
    const method = "DELETE";
    const { url, headers } = this.cloneRequestState();
    if (count) headers.append("Prefer", `count=${count}`);
    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      fetch: (_this$fetch4 = this.fetch) !== null && _this$fetch4 !== void 0 ? _this$fetch4 : fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
};
function _typeof(o) {
  "@babel/helpers - typeof";
  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
    return typeof o$1;
  } : function(o$1) {
    return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
  }, _typeof(o);
}
__name(_typeof, "_typeof");
function toPrimitive(t, r) {
  if ("object" != _typeof(t) || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != _typeof(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
__name(toPrimitive, "toPrimitive");
function toPropertyKey(t) {
  var i = toPrimitive(t, "string");
  return "symbol" == _typeof(i) ? i : i + "";
}
__name(toPropertyKey, "toPropertyKey");
function _defineProperty(e, r, t) {
  return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
__name(_defineProperty, "_defineProperty");
function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r$1) {
      return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
__name(ownKeys, "ownKeys");
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), true).forEach(function(r$1) {
      _defineProperty(e, r$1, t[r$1]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r$1) {
      Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t, r$1));
    });
  }
  return e;
}
__name(_objectSpread2, "_objectSpread2");
var PostgrestClient = class PostgrestClient2 {
  static {
    __name(this, "PostgrestClient");
  }
  /**
  * Creates a PostgREST client.
  *
  * @param url - URL of the PostgREST endpoint
  * @param options - Named parameters
  * @param options.headers - Custom headers
  * @param options.schema - Postgres schema to switch to
  * @param options.fetch - Custom fetch
  * @param options.timeout - Optional timeout in milliseconds for all requests. When set, requests will automatically abort after this duration to prevent indefinite hangs.
  * @param options.urlLengthLimit - Maximum URL length in characters before warnings/errors are triggered. Defaults to 8000.
  * @example
  * ```ts
  * import PostgrestClient from '@supabase/postgrest-js'
  *
  * const postgrest = new PostgrestClient('https://xyzcompany.supabase.co/rest/v1', {
  *   headers: { apikey: 'public-anon-key' },
  *   schema: 'public',
  *   timeout: 30000, // 30 second timeout
  * })
  * ```
  */
  constructor(url, { headers = {}, schema, fetch: fetch$1, timeout, urlLengthLimit = 8e3 } = {}) {
    this.url = url;
    this.headers = new Headers(headers);
    this.schemaName = schema;
    this.urlLengthLimit = urlLengthLimit;
    const originalFetch = fetch$1 !== null && fetch$1 !== void 0 ? fetch$1 : globalThis.fetch;
    if (timeout !== void 0 && timeout > 0) this.fetch = (input, init) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const existingSignal = init === null || init === void 0 ? void 0 : init.signal;
      if (existingSignal) {
        if (existingSignal.aborted) {
          clearTimeout(timeoutId);
          return originalFetch(input, init);
        }
        const abortHandler = /* @__PURE__ */ __name(() => {
          clearTimeout(timeoutId);
          controller.abort();
        }, "abortHandler");
        existingSignal.addEventListener("abort", abortHandler, { once: true });
        return originalFetch(input, _objectSpread2(_objectSpread2({}, init), {}, { signal: controller.signal })).finally(() => {
          clearTimeout(timeoutId);
          existingSignal.removeEventListener("abort", abortHandler);
        });
      }
      return originalFetch(input, _objectSpread2(_objectSpread2({}, init), {}, { signal: controller.signal })).finally(() => clearTimeout(timeoutId));
    };
    else this.fetch = originalFetch;
  }
  /**
  * Perform a query on a table or a view.
  *
  * @param relation - The table or view name to query
  */
  from(relation) {
    if (!relation || typeof relation !== "string" || relation.trim() === "") throw new Error("Invalid relation name: relation must be a non-empty string.");
    return new PostgrestQueryBuilder(new URL(`${this.url}/${relation}`), {
      headers: new Headers(this.headers),
      schema: this.schemaName,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
  /**
  * Select a schema to query or perform an function (rpc) call.
  *
  * The schema needs to be on the list of exposed schemas inside Supabase.
  *
  * @param schema - The schema to query
  */
  schema(schema) {
    return new PostgrestClient2(this.url, {
      headers: this.headers,
      schema,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
  /**
  * Perform a function call.
  *
  * @param fn - The function name to call
  * @param args - The arguments to pass to the function call
  * @param options - Named parameters
  * @param options.head - When set to `true`, `data` will not be returned.
  * Useful if you only need the count.
  * @param options.get - When set to `true`, the function will be called with
  * read-only access mode.
  * @param options.count - Count algorithm to use to count rows returned by the
  * function. Only applicable for [set-returning
  * functions](https://www.postgresql.org/docs/current/functions-srf.html).
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @example
  * ```ts
  * // For cross-schema functions where type inference fails, use overrideTypes:
  * const { data } = await supabase
  *   .schema('schema_b')
  *   .rpc('function_a', {})
  *   .overrideTypes<{ id: string; user_id: string }[]>()
  * ```
  */
  rpc(fn, args = {}, { head: head2 = false, get: get2 = false, count } = {}) {
    var _this$fetch;
    let method;
    const url = new URL(`${this.url}/rpc/${fn}`);
    let body;
    const _isObject = /* @__PURE__ */ __name((v) => v !== null && typeof v === "object" && (!Array.isArray(v) || v.some(_isObject)), "_isObject");
    const _hasObjectArg = head2 && Object.values(args).some(_isObject);
    if (_hasObjectArg) {
      method = "POST";
      body = args;
    } else if (head2 || get2) {
      method = head2 ? "HEAD" : "GET";
      Object.entries(args).filter(([_, value]) => value !== void 0).map(([name, value]) => [name, Array.isArray(value) ? `{${value.join(",")}}` : `${value}`]).forEach(([name, value]) => {
        url.searchParams.append(name, value);
      });
    } else {
      method = "POST";
      body = args;
    }
    const headers = new Headers(this.headers);
    if (_hasObjectArg) headers.set("Prefer", count ? `count=${count},return=minimal` : "return=minimal");
    else if (count) headers.set("Prefer", `count=${count}`);
    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schemaName,
      body,
      fetch: (_this$fetch = this.fetch) !== null && _this$fetch !== void 0 ? _this$fetch : fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
};

// node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
var WebSocketFactory = class {
  static {
    __name(this, "WebSocketFactory");
  }
  /**
   * Static-only utility – prevent instantiation.
   */
  constructor() {
  }
  static detectEnvironment() {
    var _a;
    if (typeof WebSocket !== "undefined") {
      return { type: "native", constructor: WebSocket };
    }
    if (typeof globalThis !== "undefined" && typeof globalThis.WebSocket !== "undefined") {
      return { type: "native", constructor: globalThis.WebSocket };
    }
    if (typeof global !== "undefined" && typeof global.WebSocket !== "undefined") {
      return { type: "native", constructor: global.WebSocket };
    }
    if (typeof globalThis !== "undefined" && typeof globalThis.WebSocketPair !== "undefined" && typeof globalThis.WebSocket === "undefined") {
      return {
        type: "cloudflare",
        error: "Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.",
        workaround: "Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime."
      };
    }
    if (typeof globalThis !== "undefined" && globalThis.EdgeRuntime || typeof navigator !== "undefined" && ((_a = "Cloudflare-Workers") === null || _a === void 0 ? void 0 : _a.includes("Vercel-Edge"))) {
      return {
        type: "unsupported",
        error: "Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.",
        workaround: "Use serverless functions or a different deployment target for WebSocket functionality."
      };
    }
    const _process = globalThis["process"];
    if (_process) {
      const processVersions = _process["versions"];
      if (processVersions && processVersions["node"]) {
        const versionString = processVersions["node"];
        const nodeVersion = parseInt(versionString.replace(/^v/, "").split(".")[0]);
        if (nodeVersion >= 22) {
          if (typeof globalThis.WebSocket !== "undefined") {
            return { type: "native", constructor: globalThis.WebSocket };
          }
          return {
            type: "unsupported",
            error: `Node.js ${nodeVersion} detected but native WebSocket not found.`,
            workaround: "Provide a WebSocket implementation via the transport option."
          };
        }
        return {
          type: "unsupported",
          error: `Node.js ${nodeVersion} detected without native WebSocket support.`,
          workaround: 'For Node.js < 22, install "ws" package and provide it via the transport option:\nimport ws from "ws"\nnew RealtimeClient(url, { transport: ws })'
        };
      }
    }
    return {
      type: "unsupported",
      error: "Unknown JavaScript runtime without WebSocket support.",
      workaround: "Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation."
    };
  }
  /**
   * Returns the best available WebSocket constructor for the current runtime.
   *
   * @example
   * ```ts
   * const WS = WebSocketFactory.getWebSocketConstructor()
   * const socket = new WS('wss://realtime.supabase.co/socket')
   * ```
   */
  static getWebSocketConstructor() {
    const env = this.detectEnvironment();
    if (env.constructor) {
      return env.constructor;
    }
    let errorMessage = env.error || "WebSocket not supported in this environment.";
    if (env.workaround) {
      errorMessage += `

Suggested solution: ${env.workaround}`;
    }
    throw new Error(errorMessage);
  }
  /**
   * Creates a WebSocket using the detected constructor.
   *
   * @example
   * ```ts
   * const socket = WebSocketFactory.createWebSocket('wss://realtime.supabase.co/socket')
   * ```
   */
  static createWebSocket(url, protocols) {
    const WS = this.getWebSocketConstructor();
    return new WS(url, protocols);
  }
  /**
   * Detects whether the runtime can establish WebSocket connections.
   *
   * @example
   * ```ts
   * if (!WebSocketFactory.isWebSocketSupported()) {
   *   console.warn('Falling back to long polling')
   * }
   * ```
   */
  static isWebSocketSupported() {
    try {
      const env = this.detectEnvironment();
      return env.type === "native" || env.type === "ws";
    } catch (_a) {
      return false;
    }
  }
};
var websocket_factory_default = WebSocketFactory;

// node_modules/@supabase/realtime-js/dist/module/lib/version.js
var version = "2.97.0";

// node_modules/@supabase/realtime-js/dist/module/lib/constants.js
var DEFAULT_VERSION = `realtime-js/${version}`;
var VSN_1_0_0 = "1.0.0";
var VSN_2_0_0 = "2.0.0";
var DEFAULT_VSN = VSN_2_0_0;
var DEFAULT_TIMEOUT = 1e4;
var WS_CLOSE_NORMAL = 1e3;
var MAX_PUSH_BUFFER_SIZE = 100;
var SOCKET_STATES;
(function(SOCKET_STATES2) {
  SOCKET_STATES2[SOCKET_STATES2["connecting"] = 0] = "connecting";
  SOCKET_STATES2[SOCKET_STATES2["open"] = 1] = "open";
  SOCKET_STATES2[SOCKET_STATES2["closing"] = 2] = "closing";
  SOCKET_STATES2[SOCKET_STATES2["closed"] = 3] = "closed";
})(SOCKET_STATES || (SOCKET_STATES = {}));
var CHANNEL_STATES;
(function(CHANNEL_STATES2) {
  CHANNEL_STATES2["closed"] = "closed";
  CHANNEL_STATES2["errored"] = "errored";
  CHANNEL_STATES2["joined"] = "joined";
  CHANNEL_STATES2["joining"] = "joining";
  CHANNEL_STATES2["leaving"] = "leaving";
})(CHANNEL_STATES || (CHANNEL_STATES = {}));
var CHANNEL_EVENTS;
(function(CHANNEL_EVENTS2) {
  CHANNEL_EVENTS2["close"] = "phx_close";
  CHANNEL_EVENTS2["error"] = "phx_error";
  CHANNEL_EVENTS2["join"] = "phx_join";
  CHANNEL_EVENTS2["reply"] = "phx_reply";
  CHANNEL_EVENTS2["leave"] = "phx_leave";
  CHANNEL_EVENTS2["access_token"] = "access_token";
})(CHANNEL_EVENTS || (CHANNEL_EVENTS = {}));
var TRANSPORTS;
(function(TRANSPORTS2) {
  TRANSPORTS2["websocket"] = "websocket";
})(TRANSPORTS || (TRANSPORTS = {}));
var CONNECTION_STATE;
(function(CONNECTION_STATE2) {
  CONNECTION_STATE2["Connecting"] = "connecting";
  CONNECTION_STATE2["Open"] = "open";
  CONNECTION_STATE2["Closing"] = "closing";
  CONNECTION_STATE2["Closed"] = "closed";
})(CONNECTION_STATE || (CONNECTION_STATE = {}));

// node_modules/@supabase/realtime-js/dist/module/lib/serializer.js
var Serializer = class {
  static {
    __name(this, "Serializer");
  }
  constructor(allowedMetadataKeys) {
    this.HEADER_LENGTH = 1;
    this.USER_BROADCAST_PUSH_META_LENGTH = 6;
    this.KINDS = { userBroadcastPush: 3, userBroadcast: 4 };
    this.BINARY_ENCODING = 0;
    this.JSON_ENCODING = 1;
    this.BROADCAST_EVENT = "broadcast";
    this.allowedMetadataKeys = [];
    this.allowedMetadataKeys = allowedMetadataKeys !== null && allowedMetadataKeys !== void 0 ? allowedMetadataKeys : [];
  }
  encode(msg, callback) {
    if (msg.event === this.BROADCAST_EVENT && !(msg.payload instanceof ArrayBuffer) && typeof msg.payload.event === "string") {
      return callback(this._binaryEncodeUserBroadcastPush(msg));
    }
    let payload = [msg.join_ref, msg.ref, msg.topic, msg.event, msg.payload];
    return callback(JSON.stringify(payload));
  }
  _binaryEncodeUserBroadcastPush(message2) {
    var _a;
    if (this._isArrayBuffer((_a = message2.payload) === null || _a === void 0 ? void 0 : _a.payload)) {
      return this._encodeBinaryUserBroadcastPush(message2);
    } else {
      return this._encodeJsonUserBroadcastPush(message2);
    }
  }
  _encodeBinaryUserBroadcastPush(message2) {
    var _a, _b;
    const userPayload = (_b = (_a = message2.payload) === null || _a === void 0 ? void 0 : _a.payload) !== null && _b !== void 0 ? _b : new ArrayBuffer(0);
    return this._encodeUserBroadcastPush(message2, this.BINARY_ENCODING, userPayload);
  }
  _encodeJsonUserBroadcastPush(message2) {
    var _a, _b;
    const userPayload = (_b = (_a = message2.payload) === null || _a === void 0 ? void 0 : _a.payload) !== null && _b !== void 0 ? _b : {};
    const encoder2 = new TextEncoder();
    const encodedUserPayload = encoder2.encode(JSON.stringify(userPayload)).buffer;
    return this._encodeUserBroadcastPush(message2, this.JSON_ENCODING, encodedUserPayload);
  }
  _encodeUserBroadcastPush(message2, encodingType, encodedPayload) {
    var _a, _b;
    const topic = message2.topic;
    const ref = (_a = message2.ref) !== null && _a !== void 0 ? _a : "";
    const joinRef = (_b = message2.join_ref) !== null && _b !== void 0 ? _b : "";
    const userEvent = message2.payload.event;
    const rest = this.allowedMetadataKeys ? this._pick(message2.payload, this.allowedMetadataKeys) : {};
    const metadata = Object.keys(rest).length === 0 ? "" : JSON.stringify(rest);
    if (joinRef.length > 255) {
      throw new Error(`joinRef length ${joinRef.length} exceeds maximum of 255`);
    }
    if (ref.length > 255) {
      throw new Error(`ref length ${ref.length} exceeds maximum of 255`);
    }
    if (topic.length > 255) {
      throw new Error(`topic length ${topic.length} exceeds maximum of 255`);
    }
    if (userEvent.length > 255) {
      throw new Error(`userEvent length ${userEvent.length} exceeds maximum of 255`);
    }
    if (metadata.length > 255) {
      throw new Error(`metadata length ${metadata.length} exceeds maximum of 255`);
    }
    const metaLength = this.USER_BROADCAST_PUSH_META_LENGTH + joinRef.length + ref.length + topic.length + userEvent.length + metadata.length;
    const header = new ArrayBuffer(this.HEADER_LENGTH + metaLength);
    let view = new DataView(header);
    let offset = 0;
    view.setUint8(offset++, this.KINDS.userBroadcastPush);
    view.setUint8(offset++, joinRef.length);
    view.setUint8(offset++, ref.length);
    view.setUint8(offset++, topic.length);
    view.setUint8(offset++, userEvent.length);
    view.setUint8(offset++, metadata.length);
    view.setUint8(offset++, encodingType);
    Array.from(joinRef, (char) => view.setUint8(offset++, char.charCodeAt(0)));
    Array.from(ref, (char) => view.setUint8(offset++, char.charCodeAt(0)));
    Array.from(topic, (char) => view.setUint8(offset++, char.charCodeAt(0)));
    Array.from(userEvent, (char) => view.setUint8(offset++, char.charCodeAt(0)));
    Array.from(metadata, (char) => view.setUint8(offset++, char.charCodeAt(0)));
    var combined = new Uint8Array(header.byteLength + encodedPayload.byteLength);
    combined.set(new Uint8Array(header), 0);
    combined.set(new Uint8Array(encodedPayload), header.byteLength);
    return combined.buffer;
  }
  decode(rawPayload, callback) {
    if (this._isArrayBuffer(rawPayload)) {
      let result = this._binaryDecode(rawPayload);
      return callback(result);
    }
    if (typeof rawPayload === "string") {
      const jsonPayload = JSON.parse(rawPayload);
      const [join_ref, ref, topic, event, payload] = jsonPayload;
      return callback({ join_ref, ref, topic, event, payload });
    }
    return callback({});
  }
  _binaryDecode(buffer) {
    const view = new DataView(buffer);
    const kind = view.getUint8(0);
    const decoder2 = new TextDecoder();
    switch (kind) {
      case this.KINDS.userBroadcast:
        return this._decodeUserBroadcast(buffer, view, decoder2);
    }
  }
  _decodeUserBroadcast(buffer, view, decoder2) {
    const topicSize = view.getUint8(1);
    const userEventSize = view.getUint8(2);
    const metadataSize = view.getUint8(3);
    const payloadEncoding = view.getUint8(4);
    let offset = this.HEADER_LENGTH + 4;
    const topic = decoder2.decode(buffer.slice(offset, offset + topicSize));
    offset = offset + topicSize;
    const userEvent = decoder2.decode(buffer.slice(offset, offset + userEventSize));
    offset = offset + userEventSize;
    const metadata = decoder2.decode(buffer.slice(offset, offset + metadataSize));
    offset = offset + metadataSize;
    const payload = buffer.slice(offset, buffer.byteLength);
    const parsedPayload = payloadEncoding === this.JSON_ENCODING ? JSON.parse(decoder2.decode(payload)) : payload;
    const data = {
      type: this.BROADCAST_EVENT,
      event: userEvent,
      payload: parsedPayload
    };
    if (metadataSize > 0) {
      data["meta"] = JSON.parse(metadata);
    }
    return { join_ref: null, ref: null, topic, event: this.BROADCAST_EVENT, payload: data };
  }
  _isArrayBuffer(buffer) {
    var _a;
    return buffer instanceof ArrayBuffer || ((_a = buffer === null || buffer === void 0 ? void 0 : buffer.constructor) === null || _a === void 0 ? void 0 : _a.name) === "ArrayBuffer";
  }
  _pick(obj, keys) {
    if (!obj || typeof obj !== "object") {
      return {};
    }
    return Object.fromEntries(Object.entries(obj).filter(([key]) => keys.includes(key)));
  }
};

// node_modules/@supabase/realtime-js/dist/module/lib/timer.js
var Timer = class {
  static {
    __name(this, "Timer");
  }
  constructor(callback, timerCalc) {
    this.callback = callback;
    this.timerCalc = timerCalc;
    this.timer = void 0;
    this.tries = 0;
    this.callback = callback;
    this.timerCalc = timerCalc;
  }
  reset() {
    this.tries = 0;
    clearTimeout(this.timer);
    this.timer = void 0;
  }
  // Cancels any previous scheduleTimeout and schedules callback
  scheduleTimeout() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.tries = this.tries + 1;
      this.callback();
    }, this.timerCalc(this.tries + 1));
  }
};

// node_modules/@supabase/realtime-js/dist/module/lib/transformers.js
var PostgresTypes;
(function(PostgresTypes2) {
  PostgresTypes2["abstime"] = "abstime";
  PostgresTypes2["bool"] = "bool";
  PostgresTypes2["date"] = "date";
  PostgresTypes2["daterange"] = "daterange";
  PostgresTypes2["float4"] = "float4";
  PostgresTypes2["float8"] = "float8";
  PostgresTypes2["int2"] = "int2";
  PostgresTypes2["int4"] = "int4";
  PostgresTypes2["int4range"] = "int4range";
  PostgresTypes2["int8"] = "int8";
  PostgresTypes2["int8range"] = "int8range";
  PostgresTypes2["json"] = "json";
  PostgresTypes2["jsonb"] = "jsonb";
  PostgresTypes2["money"] = "money";
  PostgresTypes2["numeric"] = "numeric";
  PostgresTypes2["oid"] = "oid";
  PostgresTypes2["reltime"] = "reltime";
  PostgresTypes2["text"] = "text";
  PostgresTypes2["time"] = "time";
  PostgresTypes2["timestamp"] = "timestamp";
  PostgresTypes2["timestamptz"] = "timestamptz";
  PostgresTypes2["timetz"] = "timetz";
  PostgresTypes2["tsrange"] = "tsrange";
  PostgresTypes2["tstzrange"] = "tstzrange";
})(PostgresTypes || (PostgresTypes = {}));
var convertChangeData = /* @__PURE__ */ __name((columns, record, options = {}) => {
  var _a;
  const skipTypes = (_a = options.skipTypes) !== null && _a !== void 0 ? _a : [];
  if (!record) {
    return {};
  }
  return Object.keys(record).reduce((acc, rec_key) => {
    acc[rec_key] = convertColumn(rec_key, columns, record, skipTypes);
    return acc;
  }, {});
}, "convertChangeData");
var convertColumn = /* @__PURE__ */ __name((columnName, columns, record, skipTypes) => {
  const column = columns.find((x) => x.name === columnName);
  const colType = column === null || column === void 0 ? void 0 : column.type;
  const value = record[columnName];
  if (colType && !skipTypes.includes(colType)) {
    return convertCell(colType, value);
  }
  return noop(value);
}, "convertColumn");
var convertCell = /* @__PURE__ */ __name((type, value) => {
  if (type.charAt(0) === "_") {
    const dataType = type.slice(1, type.length);
    return toArray(value, dataType);
  }
  switch (type) {
    case PostgresTypes.bool:
      return toBoolean(value);
    case PostgresTypes.float4:
    case PostgresTypes.float8:
    case PostgresTypes.int2:
    case PostgresTypes.int4:
    case PostgresTypes.int8:
    case PostgresTypes.numeric:
    case PostgresTypes.oid:
      return toNumber(value);
    case PostgresTypes.json:
    case PostgresTypes.jsonb:
      return toJson(value);
    case PostgresTypes.timestamp:
      return toTimestampString(value);
    // Format to be consistent with PostgREST
    case PostgresTypes.abstime:
    // To allow users to cast it based on Timezone
    case PostgresTypes.date:
    // To allow users to cast it based on Timezone
    case PostgresTypes.daterange:
    case PostgresTypes.int4range:
    case PostgresTypes.int8range:
    case PostgresTypes.money:
    case PostgresTypes.reltime:
    // To allow users to cast it based on Timezone
    case PostgresTypes.text:
    case PostgresTypes.time:
    // To allow users to cast it based on Timezone
    case PostgresTypes.timestamptz:
    // To allow users to cast it based on Timezone
    case PostgresTypes.timetz:
    // To allow users to cast it based on Timezone
    case PostgresTypes.tsrange:
    case PostgresTypes.tstzrange:
      return noop(value);
    default:
      return noop(value);
  }
}, "convertCell");
var noop = /* @__PURE__ */ __name((value) => {
  return value;
}, "noop");
var toBoolean = /* @__PURE__ */ __name((value) => {
  switch (value) {
    case "t":
      return true;
    case "f":
      return false;
    default:
      return value;
  }
}, "toBoolean");
var toNumber = /* @__PURE__ */ __name((value) => {
  if (typeof value === "string") {
    const parsedValue = parseFloat(value);
    if (!Number.isNaN(parsedValue)) {
      return parsedValue;
    }
  }
  return value;
}, "toNumber");
var toJson = /* @__PURE__ */ __name((value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_a) {
      return value;
    }
  }
  return value;
}, "toJson");
var toArray = /* @__PURE__ */ __name((value, type) => {
  if (typeof value !== "string") {
    return value;
  }
  const lastIdx = value.length - 1;
  const closeBrace = value[lastIdx];
  const openBrace = value[0];
  if (openBrace === "{" && closeBrace === "}") {
    let arr;
    const valTrim = value.slice(1, lastIdx);
    try {
      arr = JSON.parse("[" + valTrim + "]");
    } catch (_) {
      arr = valTrim ? valTrim.split(",") : [];
    }
    return arr.map((val) => convertCell(type, val));
  }
  return value;
}, "toArray");
var toTimestampString = /* @__PURE__ */ __name((value) => {
  if (typeof value === "string") {
    return value.replace(" ", "T");
  }
  return value;
}, "toTimestampString");
var httpEndpointURL = /* @__PURE__ */ __name((socketUrl) => {
  const wsUrl = new URL(socketUrl);
  wsUrl.protocol = wsUrl.protocol.replace(/^ws/i, "http");
  wsUrl.pathname = wsUrl.pathname.replace(/\/+$/, "").replace(/\/socket\/websocket$/i, "").replace(/\/socket$/i, "").replace(/\/websocket$/i, "");
  if (wsUrl.pathname === "" || wsUrl.pathname === "/") {
    wsUrl.pathname = "/api/broadcast";
  } else {
    wsUrl.pathname = wsUrl.pathname + "/api/broadcast";
  }
  return wsUrl.href;
}, "httpEndpointURL");

// node_modules/@supabase/realtime-js/dist/module/lib/push.js
var Push = class {
  static {
    __name(this, "Push");
  }
  /**
   * Initializes the Push
   *
   * @param channel The Channel
   * @param event The event, for example `"phx_join"`
   * @param payload The payload, for example `{user_id: 123}`
   * @param timeout The push timeout in milliseconds
   */
  constructor(channel, event, payload = {}, timeout = DEFAULT_TIMEOUT) {
    this.channel = channel;
    this.event = event;
    this.payload = payload;
    this.timeout = timeout;
    this.sent = false;
    this.timeoutTimer = void 0;
    this.ref = "";
    this.receivedResp = null;
    this.recHooks = [];
    this.refEvent = null;
  }
  resend(timeout) {
    this.timeout = timeout;
    this._cancelRefEvent();
    this.ref = "";
    this.refEvent = null;
    this.receivedResp = null;
    this.sent = false;
    this.send();
  }
  send() {
    if (this._hasReceived("timeout")) {
      return;
    }
    this.startTimeout();
    this.sent = true;
    this.channel.socket.push({
      topic: this.channel.topic,
      event: this.event,
      payload: this.payload,
      ref: this.ref,
      join_ref: this.channel._joinRef()
    });
  }
  updatePayload(payload) {
    this.payload = Object.assign(Object.assign({}, this.payload), payload);
  }
  receive(status, callback) {
    var _a;
    if (this._hasReceived(status)) {
      callback((_a = this.receivedResp) === null || _a === void 0 ? void 0 : _a.response);
    }
    this.recHooks.push({ status, callback });
    return this;
  }
  startTimeout() {
    if (this.timeoutTimer) {
      return;
    }
    this.ref = this.channel.socket._makeRef();
    this.refEvent = this.channel._replyEventName(this.ref);
    const callback = /* @__PURE__ */ __name((payload) => {
      this._cancelRefEvent();
      this._cancelTimeout();
      this.receivedResp = payload;
      this._matchReceive(payload);
    }, "callback");
    this.channel._on(this.refEvent, {}, callback);
    this.timeoutTimer = setTimeout(() => {
      this.trigger("timeout", {});
    }, this.timeout);
  }
  trigger(status, response) {
    if (this.refEvent)
      this.channel._trigger(this.refEvent, { status, response });
  }
  destroy() {
    this._cancelRefEvent();
    this._cancelTimeout();
  }
  _cancelRefEvent() {
    if (!this.refEvent) {
      return;
    }
    this.channel._off(this.refEvent, {});
  }
  _cancelTimeout() {
    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = void 0;
  }
  _matchReceive({ status, response }) {
    this.recHooks.filter((h) => h.status === status).forEach((h) => h.callback(response));
  }
  _hasReceived(status) {
    return this.receivedResp && this.receivedResp.status === status;
  }
};

// node_modules/@supabase/realtime-js/dist/module/RealtimePresence.js
var REALTIME_PRESENCE_LISTEN_EVENTS;
(function(REALTIME_PRESENCE_LISTEN_EVENTS2) {
  REALTIME_PRESENCE_LISTEN_EVENTS2["SYNC"] = "sync";
  REALTIME_PRESENCE_LISTEN_EVENTS2["JOIN"] = "join";
  REALTIME_PRESENCE_LISTEN_EVENTS2["LEAVE"] = "leave";
})(REALTIME_PRESENCE_LISTEN_EVENTS || (REALTIME_PRESENCE_LISTEN_EVENTS = {}));
var RealtimePresence = class _RealtimePresence {
  static {
    __name(this, "RealtimePresence");
  }
  /**
   * Creates a Presence helper that keeps the local presence state in sync with the server.
   *
   * @param channel - The realtime channel to bind to.
   * @param opts - Optional custom event names, e.g. `{ events: { state: 'state', diff: 'diff' } }`.
   *
   * @example
   * ```ts
   * const presence = new RealtimePresence(channel)
   *
   * channel.on('presence', ({ event, key }) => {
   *   console.log(`Presence ${event} on ${key}`)
   * })
   * ```
   */
  constructor(channel, opts) {
    this.channel = channel;
    this.state = {};
    this.pendingDiffs = [];
    this.joinRef = null;
    this.enabled = false;
    this.caller = {
      onJoin: /* @__PURE__ */ __name(() => {
      }, "onJoin"),
      onLeave: /* @__PURE__ */ __name(() => {
      }, "onLeave"),
      onSync: /* @__PURE__ */ __name(() => {
      }, "onSync")
    };
    const events = (opts === null || opts === void 0 ? void 0 : opts.events) || {
      state: "presence_state",
      diff: "presence_diff"
    };
    this.channel._on(events.state, {}, (newState) => {
      const { onJoin, onLeave, onSync } = this.caller;
      this.joinRef = this.channel._joinRef();
      this.state = _RealtimePresence.syncState(this.state, newState, onJoin, onLeave);
      this.pendingDiffs.forEach((diff) => {
        this.state = _RealtimePresence.syncDiff(this.state, diff, onJoin, onLeave);
      });
      this.pendingDiffs = [];
      onSync();
    });
    this.channel._on(events.diff, {}, (diff) => {
      const { onJoin, onLeave, onSync } = this.caller;
      if (this.inPendingSyncState()) {
        this.pendingDiffs.push(diff);
      } else {
        this.state = _RealtimePresence.syncDiff(this.state, diff, onJoin, onLeave);
        onSync();
      }
    });
    this.onJoin((key, currentPresences, newPresences) => {
      this.channel._trigger("presence", {
        event: "join",
        key,
        currentPresences,
        newPresences
      });
    });
    this.onLeave((key, currentPresences, leftPresences) => {
      this.channel._trigger("presence", {
        event: "leave",
        key,
        currentPresences,
        leftPresences
      });
    });
    this.onSync(() => {
      this.channel._trigger("presence", { event: "sync" });
    });
  }
  /**
   * Used to sync the list of presences on the server with the
   * client's state.
   *
   * An optional `onJoin` and `onLeave` callback can be provided to
   * react to changes in the client's local presences across
   * disconnects and reconnects with the server.
   *
   * @internal
   */
  static syncState(currentState, newState, onJoin, onLeave) {
    const state = this.cloneDeep(currentState);
    const transformedState = this.transformState(newState);
    const joins = {};
    const leaves = {};
    this.map(state, (key, presences) => {
      if (!transformedState[key]) {
        leaves[key] = presences;
      }
    });
    this.map(transformedState, (key, newPresences) => {
      const currentPresences = state[key];
      if (currentPresences) {
        const newPresenceRefs = newPresences.map((m) => m.presence_ref);
        const curPresenceRefs = currentPresences.map((m) => m.presence_ref);
        const joinedPresences = newPresences.filter((m) => curPresenceRefs.indexOf(m.presence_ref) < 0);
        const leftPresences = currentPresences.filter((m) => newPresenceRefs.indexOf(m.presence_ref) < 0);
        if (joinedPresences.length > 0) {
          joins[key] = joinedPresences;
        }
        if (leftPresences.length > 0) {
          leaves[key] = leftPresences;
        }
      } else {
        joins[key] = newPresences;
      }
    });
    return this.syncDiff(state, { joins, leaves }, onJoin, onLeave);
  }
  /**
   * Used to sync a diff of presence join and leave events from the
   * server, as they happen.
   *
   * Like `syncState`, `syncDiff` accepts optional `onJoin` and
   * `onLeave` callbacks to react to a user joining or leaving from a
   * device.
   *
   * @internal
   */
  static syncDiff(state, diff, onJoin, onLeave) {
    const { joins, leaves } = {
      joins: this.transformState(diff.joins),
      leaves: this.transformState(diff.leaves)
    };
    if (!onJoin) {
      onJoin = /* @__PURE__ */ __name(() => {
      }, "onJoin");
    }
    if (!onLeave) {
      onLeave = /* @__PURE__ */ __name(() => {
      }, "onLeave");
    }
    this.map(joins, (key, newPresences) => {
      var _a;
      const currentPresences = (_a = state[key]) !== null && _a !== void 0 ? _a : [];
      state[key] = this.cloneDeep(newPresences);
      if (currentPresences.length > 0) {
        const joinedPresenceRefs = state[key].map((m) => m.presence_ref);
        const curPresences = currentPresences.filter((m) => joinedPresenceRefs.indexOf(m.presence_ref) < 0);
        state[key].unshift(...curPresences);
      }
      onJoin(key, currentPresences, newPresences);
    });
    this.map(leaves, (key, leftPresences) => {
      let currentPresences = state[key];
      if (!currentPresences)
        return;
      const presenceRefsToRemove = leftPresences.map((m) => m.presence_ref);
      currentPresences = currentPresences.filter((m) => presenceRefsToRemove.indexOf(m.presence_ref) < 0);
      state[key] = currentPresences;
      onLeave(key, currentPresences, leftPresences);
      if (currentPresences.length === 0)
        delete state[key];
    });
    return state;
  }
  /** @internal */
  static map(obj, func) {
    return Object.getOwnPropertyNames(obj).map((key) => func(key, obj[key]));
  }
  /**
   * Remove 'metas' key
   * Change 'phx_ref' to 'presence_ref'
   * Remove 'phx_ref' and 'phx_ref_prev'
   *
   * @example
   * // returns {
   *  abc123: [
   *    { presence_ref: '2', user_id: 1 },
   *    { presence_ref: '3', user_id: 2 }
   *  ]
   * }
   * RealtimePresence.transformState({
   *  abc123: {
   *    metas: [
   *      { phx_ref: '2', phx_ref_prev: '1' user_id: 1 },
   *      { phx_ref: '3', user_id: 2 }
   *    ]
   *  }
   * })
   *
   * @internal
   */
  static transformState(state) {
    state = this.cloneDeep(state);
    return Object.getOwnPropertyNames(state).reduce((newState, key) => {
      const presences = state[key];
      if ("metas" in presences) {
        newState[key] = presences.metas.map((presence) => {
          presence["presence_ref"] = presence["phx_ref"];
          delete presence["phx_ref"];
          delete presence["phx_ref_prev"];
          return presence;
        });
      } else {
        newState[key] = presences;
      }
      return newState;
    }, {});
  }
  /** @internal */
  static cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
  /** @internal */
  onJoin(callback) {
    this.caller.onJoin = callback;
  }
  /** @internal */
  onLeave(callback) {
    this.caller.onLeave = callback;
  }
  /** @internal */
  onSync(callback) {
    this.caller.onSync = callback;
  }
  /** @internal */
  inPendingSyncState() {
    return !this.joinRef || this.joinRef !== this.channel._joinRef();
  }
};

// node_modules/@supabase/realtime-js/dist/module/RealtimeChannel.js
var REALTIME_POSTGRES_CHANGES_LISTEN_EVENT;
(function(REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2) {
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["ALL"] = "*";
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["INSERT"] = "INSERT";
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["UPDATE"] = "UPDATE";
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["DELETE"] = "DELETE";
})(REALTIME_POSTGRES_CHANGES_LISTEN_EVENT || (REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = {}));
var REALTIME_LISTEN_TYPES;
(function(REALTIME_LISTEN_TYPES2) {
  REALTIME_LISTEN_TYPES2["BROADCAST"] = "broadcast";
  REALTIME_LISTEN_TYPES2["PRESENCE"] = "presence";
  REALTIME_LISTEN_TYPES2["POSTGRES_CHANGES"] = "postgres_changes";
  REALTIME_LISTEN_TYPES2["SYSTEM"] = "system";
})(REALTIME_LISTEN_TYPES || (REALTIME_LISTEN_TYPES = {}));
var REALTIME_SUBSCRIBE_STATES;
(function(REALTIME_SUBSCRIBE_STATES2) {
  REALTIME_SUBSCRIBE_STATES2["SUBSCRIBED"] = "SUBSCRIBED";
  REALTIME_SUBSCRIBE_STATES2["TIMED_OUT"] = "TIMED_OUT";
  REALTIME_SUBSCRIBE_STATES2["CLOSED"] = "CLOSED";
  REALTIME_SUBSCRIBE_STATES2["CHANNEL_ERROR"] = "CHANNEL_ERROR";
})(REALTIME_SUBSCRIBE_STATES || (REALTIME_SUBSCRIBE_STATES = {}));
var RealtimeChannel = class _RealtimeChannel {
  static {
    __name(this, "RealtimeChannel");
  }
  /**
   * Creates a channel that can broadcast messages, sync presence, and listen to Postgres changes.
   *
   * The topic determines which realtime stream you are subscribing to. Config options let you
   * enable acknowledgement for broadcasts, presence tracking, or private channels.
   *
   * @example
   * ```ts
   * import RealtimeClient from '@supabase/realtime-js'
   *
   * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
   *   params: { apikey: 'public-anon-key' },
   * })
   * const channel = new RealtimeChannel('realtime:public:messages', { config: {} }, client)
   * ```
   */
  constructor(topic, params = { config: {} }, socket) {
    var _a, _b;
    this.topic = topic;
    this.params = params;
    this.socket = socket;
    this.bindings = {};
    this.state = CHANNEL_STATES.closed;
    this.joinedOnce = false;
    this.pushBuffer = [];
    this.subTopic = topic.replace(/^realtime:/i, "");
    this.params.config = Object.assign({
      broadcast: { ack: false, self: false },
      presence: { key: "", enabled: false },
      private: false
    }, params.config);
    this.timeout = this.socket.timeout;
    this.joinPush = new Push(this, CHANNEL_EVENTS.join, this.params, this.timeout);
    this.rejoinTimer = new Timer(() => this._rejoinUntilConnected(), this.socket.reconnectAfterMs);
    this.joinPush.receive("ok", () => {
      this.state = CHANNEL_STATES.joined;
      this.rejoinTimer.reset();
      this.pushBuffer.forEach((pushEvent) => pushEvent.send());
      this.pushBuffer = [];
    });
    this._onClose(() => {
      this.rejoinTimer.reset();
      this.socket.log("channel", `close ${this.topic} ${this._joinRef()}`);
      this.state = CHANNEL_STATES.closed;
      this.socket._remove(this);
    });
    this._onError((reason) => {
      if (this._isLeaving() || this._isClosed()) {
        return;
      }
      this.socket.log("channel", `error ${this.topic}`, reason);
      this.state = CHANNEL_STATES.errored;
      this.rejoinTimer.scheduleTimeout();
    });
    this.joinPush.receive("timeout", () => {
      if (!this._isJoining()) {
        return;
      }
      this.socket.log("channel", `timeout ${this.topic}`, this.joinPush.timeout);
      this.state = CHANNEL_STATES.errored;
      this.rejoinTimer.scheduleTimeout();
    });
    this.joinPush.receive("error", (reason) => {
      if (this._isLeaving() || this._isClosed()) {
        return;
      }
      this.socket.log("channel", `error ${this.topic}`, reason);
      this.state = CHANNEL_STATES.errored;
      this.rejoinTimer.scheduleTimeout();
    });
    this._on(CHANNEL_EVENTS.reply, {}, (payload, ref) => {
      this._trigger(this._replyEventName(ref), payload);
    });
    this.presence = new RealtimePresence(this);
    this.broadcastEndpointURL = httpEndpointURL(this.socket.endPoint);
    this.private = this.params.config.private || false;
    if (!this.private && ((_b = (_a = this.params.config) === null || _a === void 0 ? void 0 : _a.broadcast) === null || _b === void 0 ? void 0 : _b.replay)) {
      throw `tried to use replay on public channel '${this.topic}'. It must be a private channel.`;
    }
  }
  /** Subscribe registers your client with the server */
  subscribe(callback, timeout = this.timeout) {
    var _a, _b, _c;
    if (!this.socket.isConnected()) {
      this.socket.connect();
    }
    if (this.state == CHANNEL_STATES.closed) {
      const { config: { broadcast, presence, private: isPrivate } } = this.params;
      const postgres_changes = (_b = (_a = this.bindings.postgres_changes) === null || _a === void 0 ? void 0 : _a.map((r) => r.filter)) !== null && _b !== void 0 ? _b : [];
      const presence_enabled = !!this.bindings[REALTIME_LISTEN_TYPES.PRESENCE] && this.bindings[REALTIME_LISTEN_TYPES.PRESENCE].length > 0 || ((_c = this.params.config.presence) === null || _c === void 0 ? void 0 : _c.enabled) === true;
      const accessTokenPayload = {};
      const config = {
        broadcast,
        presence: Object.assign(Object.assign({}, presence), { enabled: presence_enabled }),
        postgres_changes,
        private: isPrivate
      };
      if (this.socket.accessTokenValue) {
        accessTokenPayload.access_token = this.socket.accessTokenValue;
      }
      this._onError((e) => callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, e));
      this._onClose(() => callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CLOSED));
      this.updateJoinPayload(Object.assign({ config }, accessTokenPayload));
      this.joinedOnce = true;
      this._rejoin(timeout);
      this.joinPush.receive("ok", async ({ postgres_changes: postgres_changes2 }) => {
        var _a2;
        if (!this.socket._isManualToken()) {
          this.socket.setAuth();
        }
        if (postgres_changes2 === void 0) {
          callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
          return;
        } else {
          const clientPostgresBindings = this.bindings.postgres_changes;
          const bindingsLen = (_a2 = clientPostgresBindings === null || clientPostgresBindings === void 0 ? void 0 : clientPostgresBindings.length) !== null && _a2 !== void 0 ? _a2 : 0;
          const newPostgresBindings = [];
          for (let i = 0; i < bindingsLen; i++) {
            const clientPostgresBinding = clientPostgresBindings[i];
            const { filter: { event, schema, table, filter } } = clientPostgresBinding;
            const serverPostgresFilter = postgres_changes2 && postgres_changes2[i];
            if (serverPostgresFilter && serverPostgresFilter.event === event && _RealtimeChannel.isFilterValueEqual(serverPostgresFilter.schema, schema) && _RealtimeChannel.isFilterValueEqual(serverPostgresFilter.table, table) && _RealtimeChannel.isFilterValueEqual(serverPostgresFilter.filter, filter)) {
              newPostgresBindings.push(Object.assign(Object.assign({}, clientPostgresBinding), { id: serverPostgresFilter.id }));
            } else {
              this.unsubscribe();
              this.state = CHANNEL_STATES.errored;
              callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, new Error("mismatch between server and client bindings for postgres changes"));
              return;
            }
          }
          this.bindings.postgres_changes = newPostgresBindings;
          callback && callback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
          return;
        }
      }).receive("error", (error) => {
        this.state = CHANNEL_STATES.errored;
        callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, new Error(JSON.stringify(Object.values(error).join(", ") || "error")));
        return;
      }).receive("timeout", () => {
        callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.TIMED_OUT);
        return;
      });
    }
    return this;
  }
  /**
   * Returns the current presence state for this channel.
   *
   * The shape is a map keyed by presence key (for example a user id) where each entry contains the
   * tracked metadata for that user.
   */
  presenceState() {
    return this.presence.state;
  }
  /**
   * Sends the supplied payload to the presence tracker so other subscribers can see that this
   * client is online. Use `untrack` to stop broadcasting presence for the same key.
   */
  async track(payload, opts = {}) {
    return await this.send({
      type: "presence",
      event: "track",
      payload
    }, opts.timeout || this.timeout);
  }
  /**
   * Removes the current presence state for this client.
   */
  async untrack(opts = {}) {
    return await this.send({
      type: "presence",
      event: "untrack"
    }, opts);
  }
  on(type, filter, callback) {
    if (this.state === CHANNEL_STATES.joined && type === REALTIME_LISTEN_TYPES.PRESENCE) {
      this.socket.log("channel", `resubscribe to ${this.topic} due to change in presence callbacks on joined channel`);
      this.unsubscribe().then(async () => await this.subscribe());
    }
    return this._on(type, filter, callback);
  }
  /**
   * Sends a broadcast message explicitly via REST API.
   *
   * This method always uses the REST API endpoint regardless of WebSocket connection state.
   * Useful when you want to guarantee REST delivery or when gradually migrating from implicit REST fallback.
   *
   * @param event The name of the broadcast event
   * @param payload Payload to be sent (required)
   * @param opts Options including timeout
   * @returns Promise resolving to object with success status, and error details if failed
   */
  async httpSend(event, payload, opts = {}) {
    var _a;
    if (payload === void 0 || payload === null) {
      return Promise.reject("Payload is required for httpSend()");
    }
    const headers = {
      apikey: this.socket.apiKey ? this.socket.apiKey : "",
      "Content-Type": "application/json"
    };
    if (this.socket.accessTokenValue) {
      headers["Authorization"] = `Bearer ${this.socket.accessTokenValue}`;
    }
    const options = {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: [
          {
            topic: this.subTopic,
            event,
            payload,
            private: this.private
          }
        ]
      })
    };
    const response = await this._fetchWithTimeout(this.broadcastEndpointURL, options, (_a = opts.timeout) !== null && _a !== void 0 ? _a : this.timeout);
    if (response.status === 202) {
      return { success: true };
    }
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || errorMessage;
    } catch (_b) {
    }
    return Promise.reject(new Error(errorMessage));
  }
  /**
   * Sends a message into the channel.
   *
   * @param args Arguments to send to channel
   * @param args.type The type of event to send
   * @param args.event The name of the event being sent
   * @param args.payload Payload to be sent
   * @param opts Options to be used during the send process
   */
  async send(args, opts = {}) {
    var _a, _b;
    if (!this._canPush() && args.type === "broadcast") {
      console.warn("Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.");
      const { event, payload: endpoint_payload } = args;
      const headers = {
        apikey: this.socket.apiKey ? this.socket.apiKey : "",
        "Content-Type": "application/json"
      };
      if (this.socket.accessTokenValue) {
        headers["Authorization"] = `Bearer ${this.socket.accessTokenValue}`;
      }
      const options = {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [
            {
              topic: this.subTopic,
              event,
              payload: endpoint_payload,
              private: this.private
            }
          ]
        })
      };
      try {
        const response = await this._fetchWithTimeout(this.broadcastEndpointURL, options, (_a = opts.timeout) !== null && _a !== void 0 ? _a : this.timeout);
        await ((_b = response.body) === null || _b === void 0 ? void 0 : _b.cancel());
        return response.ok ? "ok" : "error";
      } catch (error) {
        if (error.name === "AbortError") {
          return "timed out";
        } else {
          return "error";
        }
      }
    } else {
      return new Promise((resolve) => {
        var _a2, _b2, _c;
        const push = this._push(args.type, args, opts.timeout || this.timeout);
        if (args.type === "broadcast" && !((_c = (_b2 = (_a2 = this.params) === null || _a2 === void 0 ? void 0 : _a2.config) === null || _b2 === void 0 ? void 0 : _b2.broadcast) === null || _c === void 0 ? void 0 : _c.ack)) {
          resolve("ok");
        }
        push.receive("ok", () => resolve("ok"));
        push.receive("error", () => resolve("error"));
        push.receive("timeout", () => resolve("timed out"));
      });
    }
  }
  /**
   * Updates the payload that will be sent the next time the channel joins (reconnects).
   * Useful for rotating access tokens or updating config without re-creating the channel.
   */
  updateJoinPayload(payload) {
    this.joinPush.updatePayload(payload);
  }
  /**
   * Leaves the channel.
   *
   * Unsubscribes from server events, and instructs channel to terminate on server.
   * Triggers onClose() hooks.
   *
   * To receive leave acknowledgements, use the a `receive` hook to bind to the server ack, ie:
   * channel.unsubscribe().receive("ok", () => alert("left!") )
   */
  unsubscribe(timeout = this.timeout) {
    this.state = CHANNEL_STATES.leaving;
    const onClose = /* @__PURE__ */ __name(() => {
      this.socket.log("channel", `leave ${this.topic}`);
      this._trigger(CHANNEL_EVENTS.close, "leave", this._joinRef());
    }, "onClose");
    this.joinPush.destroy();
    let leavePush = null;
    return new Promise((resolve) => {
      leavePush = new Push(this, CHANNEL_EVENTS.leave, {}, timeout);
      leavePush.receive("ok", () => {
        onClose();
        resolve("ok");
      }).receive("timeout", () => {
        onClose();
        resolve("timed out");
      }).receive("error", () => {
        resolve("error");
      });
      leavePush.send();
      if (!this._canPush()) {
        leavePush.trigger("ok", {});
      }
    }).finally(() => {
      leavePush === null || leavePush === void 0 ? void 0 : leavePush.destroy();
    });
  }
  /**
   * Teardown the channel.
   *
   * Destroys and stops related timers.
   */
  teardown() {
    this.pushBuffer.forEach((push) => push.destroy());
    this.pushBuffer = [];
    this.rejoinTimer.reset();
    this.joinPush.destroy();
    this.state = CHANNEL_STATES.closed;
    this.bindings = {};
  }
  /** @internal */
  async _fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await this.socket.fetch(url, Object.assign(Object.assign({}, options), { signal: controller.signal }));
    clearTimeout(id);
    return response;
  }
  /** @internal */
  _push(event, payload, timeout = this.timeout) {
    if (!this.joinedOnce) {
      throw `tried to push '${event}' to '${this.topic}' before joining. Use channel.subscribe() before pushing events`;
    }
    let pushEvent = new Push(this, event, payload, timeout);
    if (this._canPush()) {
      pushEvent.send();
    } else {
      this._addToPushBuffer(pushEvent);
    }
    return pushEvent;
  }
  /** @internal */
  _addToPushBuffer(pushEvent) {
    pushEvent.startTimeout();
    this.pushBuffer.push(pushEvent);
    if (this.pushBuffer.length > MAX_PUSH_BUFFER_SIZE) {
      const removedPush = this.pushBuffer.shift();
      if (removedPush) {
        removedPush.destroy();
        this.socket.log("channel", `discarded push due to buffer overflow: ${removedPush.event}`, removedPush.payload);
      }
    }
  }
  /**
   * Overridable message hook
   *
   * Receives all events for specialized message handling before dispatching to the channel callbacks.
   * Must return the payload, modified or unmodified.
   *
   * @internal
   */
  _onMessage(_event, payload, _ref) {
    return payload;
  }
  /** @internal */
  _isMember(topic) {
    return this.topic === topic;
  }
  /** @internal */
  _joinRef() {
    return this.joinPush.ref;
  }
  /** @internal */
  _trigger(type, payload, ref) {
    var _a, _b;
    const typeLower = type.toLocaleLowerCase();
    const { close, error, leave, join } = CHANNEL_EVENTS;
    const events = [close, error, leave, join];
    if (ref && events.indexOf(typeLower) >= 0 && ref !== this._joinRef()) {
      return;
    }
    let handledPayload = this._onMessage(typeLower, payload, ref);
    if (payload && !handledPayload) {
      throw "channel onMessage callbacks must return the payload, modified or unmodified";
    }
    if (["insert", "update", "delete"].includes(typeLower)) {
      (_a = this.bindings.postgres_changes) === null || _a === void 0 ? void 0 : _a.filter((bind) => {
        var _a2, _b2, _c;
        return ((_a2 = bind.filter) === null || _a2 === void 0 ? void 0 : _a2.event) === "*" || ((_c = (_b2 = bind.filter) === null || _b2 === void 0 ? void 0 : _b2.event) === null || _c === void 0 ? void 0 : _c.toLocaleLowerCase()) === typeLower;
      }).map((bind) => bind.callback(handledPayload, ref));
    } else {
      (_b = this.bindings[typeLower]) === null || _b === void 0 ? void 0 : _b.filter((bind) => {
        var _a2, _b2, _c, _d, _e, _f;
        if (["broadcast", "presence", "postgres_changes"].includes(typeLower)) {
          if ("id" in bind) {
            const bindId = bind.id;
            const bindEvent = (_a2 = bind.filter) === null || _a2 === void 0 ? void 0 : _a2.event;
            return bindId && ((_b2 = payload.ids) === null || _b2 === void 0 ? void 0 : _b2.includes(bindId)) && (bindEvent === "*" || (bindEvent === null || bindEvent === void 0 ? void 0 : bindEvent.toLocaleLowerCase()) === ((_c = payload.data) === null || _c === void 0 ? void 0 : _c.type.toLocaleLowerCase()));
          } else {
            const bindEvent = (_e = (_d = bind === null || bind === void 0 ? void 0 : bind.filter) === null || _d === void 0 ? void 0 : _d.event) === null || _e === void 0 ? void 0 : _e.toLocaleLowerCase();
            return bindEvent === "*" || bindEvent === ((_f = payload === null || payload === void 0 ? void 0 : payload.event) === null || _f === void 0 ? void 0 : _f.toLocaleLowerCase());
          }
        } else {
          return bind.type.toLocaleLowerCase() === typeLower;
        }
      }).map((bind) => {
        if (typeof handledPayload === "object" && "ids" in handledPayload) {
          const postgresChanges = handledPayload.data;
          const { schema, table, commit_timestamp, type: type2, errors } = postgresChanges;
          const enrichedPayload = {
            schema,
            table,
            commit_timestamp,
            eventType: type2,
            new: {},
            old: {},
            errors
          };
          handledPayload = Object.assign(Object.assign({}, enrichedPayload), this._getPayloadRecords(postgresChanges));
        }
        bind.callback(handledPayload, ref);
      });
    }
  }
  /** @internal */
  _isClosed() {
    return this.state === CHANNEL_STATES.closed;
  }
  /** @internal */
  _isJoined() {
    return this.state === CHANNEL_STATES.joined;
  }
  /** @internal */
  _isJoining() {
    return this.state === CHANNEL_STATES.joining;
  }
  /** @internal */
  _isLeaving() {
    return this.state === CHANNEL_STATES.leaving;
  }
  /** @internal */
  _replyEventName(ref) {
    return `chan_reply_${ref}`;
  }
  /** @internal */
  _on(type, filter, callback) {
    const typeLower = type.toLocaleLowerCase();
    const binding = {
      type: typeLower,
      filter,
      callback
    };
    if (this.bindings[typeLower]) {
      this.bindings[typeLower].push(binding);
    } else {
      this.bindings[typeLower] = [binding];
    }
    return this;
  }
  /** @internal */
  _off(type, filter) {
    const typeLower = type.toLocaleLowerCase();
    if (this.bindings[typeLower]) {
      this.bindings[typeLower] = this.bindings[typeLower].filter((bind) => {
        var _a;
        return !(((_a = bind.type) === null || _a === void 0 ? void 0 : _a.toLocaleLowerCase()) === typeLower && _RealtimeChannel.isEqual(bind.filter, filter));
      });
    }
    return this;
  }
  /** @internal */
  static isEqual(obj1, obj2) {
    if (Object.keys(obj1).length !== Object.keys(obj2).length) {
      return false;
    }
    for (const k in obj1) {
      if (obj1[k] !== obj2[k]) {
        return false;
      }
    }
    return true;
  }
  /**
   * Compares two optional filter values for equality.
   * Treats undefined, null, and empty string as equivalent empty values.
   * @internal
   */
  static isFilterValueEqual(serverValue, clientValue) {
    const normalizedServer = serverValue !== null && serverValue !== void 0 ? serverValue : void 0;
    const normalizedClient = clientValue !== null && clientValue !== void 0 ? clientValue : void 0;
    return normalizedServer === normalizedClient;
  }
  /** @internal */
  _rejoinUntilConnected() {
    this.rejoinTimer.scheduleTimeout();
    if (this.socket.isConnected()) {
      this._rejoin();
    }
  }
  /**
   * Registers a callback that will be executed when the channel closes.
   *
   * @internal
   */
  _onClose(callback) {
    this._on(CHANNEL_EVENTS.close, {}, callback);
  }
  /**
   * Registers a callback that will be executed when the channel encounteres an error.
   *
   * @internal
   */
  _onError(callback) {
    this._on(CHANNEL_EVENTS.error, {}, (reason) => callback(reason));
  }
  /**
   * Returns `true` if the socket is connected and the channel has been joined.
   *
   * @internal
   */
  _canPush() {
    return this.socket.isConnected() && this._isJoined();
  }
  /** @internal */
  _rejoin(timeout = this.timeout) {
    if (this._isLeaving()) {
      return;
    }
    this.socket._leaveOpenTopic(this.topic);
    this.state = CHANNEL_STATES.joining;
    this.joinPush.resend(timeout);
  }
  /** @internal */
  _getPayloadRecords(payload) {
    const records = {
      new: {},
      old: {}
    };
    if (payload.type === "INSERT" || payload.type === "UPDATE") {
      records.new = convertChangeData(payload.columns, payload.record);
    }
    if (payload.type === "UPDATE" || payload.type === "DELETE") {
      records.old = convertChangeData(payload.columns, payload.old_record);
    }
    return records;
  }
};

// node_modules/@supabase/realtime-js/dist/module/RealtimeClient.js
var noop2 = /* @__PURE__ */ __name(() => {
}, "noop");
var CONNECTION_TIMEOUTS = {
  HEARTBEAT_INTERVAL: 25e3,
  RECONNECT_DELAY: 10,
  HEARTBEAT_TIMEOUT_FALLBACK: 100
};
var RECONNECT_INTERVALS = [1e3, 2e3, 5e3, 1e4];
var DEFAULT_RECONNECT_FALLBACK = 1e4;
var WORKER_SCRIPT = `
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`;
var RealtimeClient = class {
  static {
    __name(this, "RealtimeClient");
  }
  /**
   * Initializes the Socket.
   *
   * @param endPoint The string WebSocket endpoint, ie, "ws://example.com/socket", "wss://example.com", "/socket" (inherited host & protocol)
   * @param httpEndpoint The string HTTP endpoint, ie, "https://example.com", "/" (inherited host & protocol)
   * @param options.transport The Websocket Transport, for example WebSocket. This can be a custom implementation
   * @param options.timeout The default timeout in milliseconds to trigger push timeouts.
   * @param options.params The optional params to pass when connecting.
   * @param options.headers Deprecated: headers cannot be set on websocket connections and this option will be removed in the future.
   * @param options.heartbeatIntervalMs The millisec interval to send a heartbeat message.
   * @param options.heartbeatCallback The optional function to handle heartbeat status and latency.
   * @param options.logger The optional function for specialized logging, ie: logger: (kind, msg, data) => { console.log(`${kind}: ${msg}`, data) }
   * @param options.logLevel Sets the log level for Realtime
   * @param options.encode The function to encode outgoing messages. Defaults to JSON: (payload, callback) => callback(JSON.stringify(payload))
   * @param options.decode The function to decode incoming messages. Defaults to Serializer's decode.
   * @param options.reconnectAfterMs he optional function that returns the millsec reconnect interval. Defaults to stepped backoff off.
   * @param options.worker Use Web Worker to set a side flow. Defaults to false.
   * @param options.workerUrl The URL of the worker script. Defaults to https://realtime.supabase.com/worker.js that includes a heartbeat event call to keep the connection alive.
   * @param options.vsn The protocol version to use when connecting. Supported versions are "1.0.0" and "2.0.0". Defaults to "2.0.0".
   * @example
   * ```ts
   * import RealtimeClient from '@supabase/realtime-js'
   *
   * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
   *   params: { apikey: 'public-anon-key' },
   * })
   * client.connect()
   * ```
   */
  constructor(endPoint, options) {
    var _a;
    this.accessTokenValue = null;
    this.apiKey = null;
    this._manuallySetToken = false;
    this.channels = new Array();
    this.endPoint = "";
    this.httpEndpoint = "";
    this.headers = {};
    this.params = {};
    this.timeout = DEFAULT_TIMEOUT;
    this.transport = null;
    this.heartbeatIntervalMs = CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL;
    this.heartbeatTimer = void 0;
    this.pendingHeartbeatRef = null;
    this.heartbeatCallback = noop2;
    this.ref = 0;
    this.reconnectTimer = null;
    this.vsn = DEFAULT_VSN;
    this.logger = noop2;
    this.conn = null;
    this.sendBuffer = [];
    this.serializer = new Serializer();
    this.stateChangeCallbacks = {
      open: [],
      close: [],
      error: [],
      message: []
    };
    this.accessToken = null;
    this._connectionState = "disconnected";
    this._wasManualDisconnect = false;
    this._authPromise = null;
    this._heartbeatSentAt = null;
    this._resolveFetch = (customFetch) => {
      if (customFetch) {
        return (...args) => customFetch(...args);
      }
      return (...args) => fetch(...args);
    };
    if (!((_a = options === null || options === void 0 ? void 0 : options.params) === null || _a === void 0 ? void 0 : _a.apikey)) {
      throw new Error("API key is required to connect to Realtime");
    }
    this.apiKey = options.params.apikey;
    this.endPoint = `${endPoint}/${TRANSPORTS.websocket}`;
    this.httpEndpoint = httpEndpointURL(endPoint);
    this._initializeOptions(options);
    this._setupReconnectionTimer();
    this.fetch = this._resolveFetch(options === null || options === void 0 ? void 0 : options.fetch);
  }
  /**
   * Connects the socket, unless already connected.
   */
  connect() {
    if (this.isConnecting() || this.isDisconnecting() || this.conn !== null && this.isConnected()) {
      return;
    }
    this._setConnectionState("connecting");
    if (this.accessToken && !this._authPromise) {
      this._setAuthSafely("connect");
    }
    if (this.transport) {
      this.conn = new this.transport(this.endpointURL());
    } else {
      try {
        this.conn = websocket_factory_default.createWebSocket(this.endpointURL());
      } catch (error) {
        this._setConnectionState("disconnected");
        const errorMessage = error.message;
        if (errorMessage.includes("Node.js")) {
          throw new Error(`${errorMessage}

To use Realtime in Node.js, you need to provide a WebSocket implementation:

Option 1: Use Node.js 22+ which has native WebSocket support
Option 2: Install and provide the "ws" package:

  npm install ws

  import ws from "ws"
  const client = new RealtimeClient(url, {
    ...options,
    transport: ws
  })`);
        }
        throw new Error(`WebSocket not available: ${errorMessage}`);
      }
    }
    this._setupConnectionHandlers();
  }
  /**
   * Returns the URL of the websocket.
   * @returns string The URL of the websocket.
   */
  endpointURL() {
    return this._appendParams(this.endPoint, Object.assign({}, this.params, { vsn: this.vsn }));
  }
  /**
   * Disconnects the socket.
   *
   * @param code A numeric status code to send on disconnect.
   * @param reason A custom reason for the disconnect.
   */
  disconnect(code, reason) {
    if (this.isDisconnecting()) {
      return;
    }
    this._setConnectionState("disconnecting", true);
    if (this.conn) {
      const fallbackTimer = setTimeout(() => {
        this._setConnectionState("disconnected");
      }, 100);
      this.conn.onclose = () => {
        clearTimeout(fallbackTimer);
        this._setConnectionState("disconnected");
      };
      if (typeof this.conn.close === "function") {
        if (code) {
          this.conn.close(code, reason !== null && reason !== void 0 ? reason : "");
        } else {
          this.conn.close();
        }
      }
      this._teardownConnection();
    } else {
      this._setConnectionState("disconnected");
    }
  }
  /**
   * Returns all created channels
   */
  getChannels() {
    return this.channels;
  }
  /**
   * Unsubscribes and removes a single channel
   * @param channel A RealtimeChannel instance
   */
  async removeChannel(channel) {
    const status = await channel.unsubscribe();
    if (this.channels.length === 0) {
      this.disconnect();
    }
    return status;
  }
  /**
   * Unsubscribes and removes all channels
   */
  async removeAllChannels() {
    const values_1 = await Promise.all(this.channels.map((channel) => channel.unsubscribe()));
    this.channels = [];
    this.disconnect();
    return values_1;
  }
  /**
   * Logs the message.
   *
   * For customized logging, `this.logger` can be overridden.
   */
  log(kind, msg, data) {
    this.logger(kind, msg, data);
  }
  /**
   * Returns the current state of the socket.
   */
  connectionState() {
    switch (this.conn && this.conn.readyState) {
      case SOCKET_STATES.connecting:
        return CONNECTION_STATE.Connecting;
      case SOCKET_STATES.open:
        return CONNECTION_STATE.Open;
      case SOCKET_STATES.closing:
        return CONNECTION_STATE.Closing;
      default:
        return CONNECTION_STATE.Closed;
    }
  }
  /**
   * Returns `true` is the connection is open.
   */
  isConnected() {
    return this.connectionState() === CONNECTION_STATE.Open;
  }
  /**
   * Returns `true` if the connection is currently connecting.
   */
  isConnecting() {
    return this._connectionState === "connecting";
  }
  /**
   * Returns `true` if the connection is currently disconnecting.
   */
  isDisconnecting() {
    return this._connectionState === "disconnecting";
  }
  /**
   * Creates (or reuses) a {@link RealtimeChannel} for the provided topic.
   *
   * Topics are automatically prefixed with `realtime:` to match the Realtime service.
   * If a channel with the same topic already exists it will be returned instead of creating
   * a duplicate connection.
   */
  channel(topic, params = { config: {} }) {
    const realtimeTopic = `realtime:${topic}`;
    const exists = this.getChannels().find((c) => c.topic === realtimeTopic);
    if (!exists) {
      const chan = new RealtimeChannel(`realtime:${topic}`, params, this);
      this.channels.push(chan);
      return chan;
    } else {
      return exists;
    }
  }
  /**
   * Push out a message if the socket is connected.
   *
   * If the socket is not connected, the message gets enqueued within a local buffer, and sent out when a connection is next established.
   */
  push(data) {
    const { topic, event, payload, ref } = data;
    const callback = /* @__PURE__ */ __name(() => {
      this.encode(data, (result) => {
        var _a;
        (_a = this.conn) === null || _a === void 0 ? void 0 : _a.send(result);
      });
    }, "callback");
    this.log("push", `${topic} ${event} (${ref})`, payload);
    if (this.isConnected()) {
      callback();
    } else {
      this.sendBuffer.push(callback);
    }
  }
  /**
   * Sets the JWT access token used for channel subscription authorization and Realtime RLS.
   *
   * If param is null it will use the `accessToken` callback function or the token set on the client.
   *
   * On callback used, it will set the value of the token internal to the client.
   *
   * When a token is explicitly provided, it will be preserved across channel operations
   * (including removeChannel and resubscribe). The `accessToken` callback will not be
   * invoked until `setAuth()` is called without arguments.
   *
   * @param token A JWT string to override the token set on the client.
   *
   * @example
   * // Use a manual token (preserved across resubscribes, ignores accessToken callback)
   * client.realtime.setAuth('my-custom-jwt')
   *
   * // Switch back to using the accessToken callback
   * client.realtime.setAuth()
   */
  async setAuth(token = null) {
    this._authPromise = this._performAuth(token);
    try {
      await this._authPromise;
    } finally {
      this._authPromise = null;
    }
  }
  /**
   * Returns true if the current access token was explicitly set via setAuth(token),
   * false if it was obtained via the accessToken callback.
   * @internal
   */
  _isManualToken() {
    return this._manuallySetToken;
  }
  /**
   * Sends a heartbeat message if the socket is connected.
   */
  async sendHeartbeat() {
    var _a;
    if (!this.isConnected()) {
      try {
        this.heartbeatCallback("disconnected");
      } catch (e) {
        this.log("error", "error in heartbeat callback", e);
      }
      return;
    }
    if (this.pendingHeartbeatRef) {
      this.pendingHeartbeatRef = null;
      this._heartbeatSentAt = null;
      this.log("transport", "heartbeat timeout. Attempting to re-establish connection");
      try {
        this.heartbeatCallback("timeout");
      } catch (e) {
        this.log("error", "error in heartbeat callback", e);
      }
      this._wasManualDisconnect = false;
      (_a = this.conn) === null || _a === void 0 ? void 0 : _a.close(WS_CLOSE_NORMAL, "heartbeat timeout");
      setTimeout(() => {
        var _a2;
        if (!this.isConnected()) {
          (_a2 = this.reconnectTimer) === null || _a2 === void 0 ? void 0 : _a2.scheduleTimeout();
        }
      }, CONNECTION_TIMEOUTS.HEARTBEAT_TIMEOUT_FALLBACK);
      return;
    }
    this._heartbeatSentAt = Date.now();
    this.pendingHeartbeatRef = this._makeRef();
    this.push({
      topic: "phoenix",
      event: "heartbeat",
      payload: {},
      ref: this.pendingHeartbeatRef
    });
    try {
      this.heartbeatCallback("sent");
    } catch (e) {
      this.log("error", "error in heartbeat callback", e);
    }
    this._setAuthSafely("heartbeat");
  }
  /**
   * Sets a callback that receives lifecycle events for internal heartbeat messages.
   * Useful for instrumenting connection health (e.g. sent/ok/timeout/disconnected).
   */
  onHeartbeat(callback) {
    this.heartbeatCallback = callback;
  }
  /**
   * Flushes send buffer
   */
  flushSendBuffer() {
    if (this.isConnected() && this.sendBuffer.length > 0) {
      this.sendBuffer.forEach((callback) => callback());
      this.sendBuffer = [];
    }
  }
  /**
   * Return the next message ref, accounting for overflows
   *
   * @internal
   */
  _makeRef() {
    let newRef = this.ref + 1;
    if (newRef === this.ref) {
      this.ref = 0;
    } else {
      this.ref = newRef;
    }
    return this.ref.toString();
  }
  /**
   * Unsubscribe from channels with the specified topic.
   *
   * @internal
   */
  _leaveOpenTopic(topic) {
    let dupChannel = this.channels.find((c) => c.topic === topic && (c._isJoined() || c._isJoining()));
    if (dupChannel) {
      this.log("transport", `leaving duplicate topic "${topic}"`);
      dupChannel.unsubscribe();
    }
  }
  /**
   * Removes a subscription from the socket.
   *
   * @param channel An open subscription.
   *
   * @internal
   */
  _remove(channel) {
    this.channels = this.channels.filter((c) => c.topic !== channel.topic);
  }
  /** @internal */
  _onConnMessage(rawMessage) {
    this.decode(rawMessage.data, (msg) => {
      if (msg.topic === "phoenix" && msg.event === "phx_reply" && msg.ref && msg.ref === this.pendingHeartbeatRef) {
        const latency = this._heartbeatSentAt ? Date.now() - this._heartbeatSentAt : void 0;
        try {
          this.heartbeatCallback(msg.payload.status === "ok" ? "ok" : "error", latency);
        } catch (e) {
          this.log("error", "error in heartbeat callback", e);
        }
        this._heartbeatSentAt = null;
        this.pendingHeartbeatRef = null;
      }
      const { topic, event, payload, ref } = msg;
      const refString = ref ? `(${ref})` : "";
      const status = payload.status || "";
      this.log("receive", `${status} ${topic} ${event} ${refString}`.trim(), payload);
      this.channels.filter((channel) => channel._isMember(topic)).forEach((channel) => channel._trigger(event, payload, ref));
      this._triggerStateCallbacks("message", msg);
    });
  }
  /**
   * Clear specific timer
   * @internal
   */
  _clearTimer(timer) {
    var _a;
    if (timer === "heartbeat" && this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = void 0;
    } else if (timer === "reconnect") {
      (_a = this.reconnectTimer) === null || _a === void 0 ? void 0 : _a.reset();
    }
  }
  /**
   * Clear all timers
   * @internal
   */
  _clearAllTimers() {
    this._clearTimer("heartbeat");
    this._clearTimer("reconnect");
  }
  /**
   * Setup connection handlers for WebSocket events
   * @internal
   */
  _setupConnectionHandlers() {
    if (!this.conn)
      return;
    if ("binaryType" in this.conn) {
      ;
      this.conn.binaryType = "arraybuffer";
    }
    this.conn.onopen = () => this._onConnOpen();
    this.conn.onerror = (error) => this._onConnError(error);
    this.conn.onmessage = (event) => this._onConnMessage(event);
    this.conn.onclose = (event) => this._onConnClose(event);
    if (this.conn.readyState === SOCKET_STATES.open) {
      this._onConnOpen();
    }
  }
  /**
   * Teardown connection and cleanup resources
   * @internal
   */
  _teardownConnection() {
    if (this.conn) {
      if (this.conn.readyState === SOCKET_STATES.open || this.conn.readyState === SOCKET_STATES.connecting) {
        try {
          this.conn.close();
        } catch (e) {
          this.log("error", "Error closing connection", e);
        }
      }
      this.conn.onopen = null;
      this.conn.onerror = null;
      this.conn.onmessage = null;
      this.conn.onclose = null;
      this.conn = null;
    }
    this._clearAllTimers();
    this._terminateWorker();
    this.channels.forEach((channel) => channel.teardown());
  }
  /** @internal */
  _onConnOpen() {
    this._setConnectionState("connected");
    this.log("transport", `connected to ${this.endpointURL()}`);
    const authPromise = this._authPromise || (this.accessToken && !this.accessTokenValue ? this.setAuth() : Promise.resolve());
    authPromise.then(() => {
      this.flushSendBuffer();
    }).catch((e) => {
      this.log("error", "error waiting for auth on connect", e);
      this.flushSendBuffer();
    });
    this._clearTimer("reconnect");
    if (!this.worker) {
      this._startHeartbeat();
    } else {
      if (!this.workerRef) {
        this._startWorkerHeartbeat();
      }
    }
    this._triggerStateCallbacks("open");
  }
  /** @internal */
  _startHeartbeat() {
    this.heartbeatTimer && clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs);
  }
  /** @internal */
  _startWorkerHeartbeat() {
    if (this.workerUrl) {
      this.log("worker", `starting worker for from ${this.workerUrl}`);
    } else {
      this.log("worker", `starting default worker`);
    }
    const objectUrl = this._workerObjectUrl(this.workerUrl);
    this.workerRef = new Worker(objectUrl);
    this.workerRef.onerror = (error) => {
      this.log("worker", "worker error", error.message);
      this._terminateWorker();
    };
    this.workerRef.onmessage = (event) => {
      if (event.data.event === "keepAlive") {
        this.sendHeartbeat();
      }
    };
    this.workerRef.postMessage({
      event: "start",
      interval: this.heartbeatIntervalMs
    });
  }
  /**
   * Terminate the Web Worker and clear the reference
   * @internal
   */
  _terminateWorker() {
    if (this.workerRef) {
      this.log("worker", "terminating worker");
      this.workerRef.terminate();
      this.workerRef = void 0;
    }
  }
  /** @internal */
  _onConnClose(event) {
    var _a;
    this._setConnectionState("disconnected");
    this.log("transport", "close", event);
    this._triggerChanError();
    this._clearTimer("heartbeat");
    if (!this._wasManualDisconnect) {
      (_a = this.reconnectTimer) === null || _a === void 0 ? void 0 : _a.scheduleTimeout();
    }
    this._triggerStateCallbacks("close", event);
  }
  /** @internal */
  _onConnError(error) {
    this._setConnectionState("disconnected");
    this.log("transport", `${error}`);
    this._triggerChanError();
    this._triggerStateCallbacks("error", error);
    try {
      this.heartbeatCallback("error");
    } catch (e) {
      this.log("error", "error in heartbeat callback", e);
    }
  }
  /** @internal */
  _triggerChanError() {
    this.channels.forEach((channel) => channel._trigger(CHANNEL_EVENTS.error));
  }
  /** @internal */
  _appendParams(url, params) {
    if (Object.keys(params).length === 0) {
      return url;
    }
    const prefix = url.match(/\?/) ? "&" : "?";
    const query = new URLSearchParams(params);
    return `${url}${prefix}${query}`;
  }
  _workerObjectUrl(url) {
    let result_url;
    if (url) {
      result_url = url;
    } else {
      const blob = new Blob([WORKER_SCRIPT], { type: "application/javascript" });
      result_url = URL.createObjectURL(blob);
    }
    return result_url;
  }
  /**
   * Set connection state with proper state management
   * @internal
   */
  _setConnectionState(state, manual = false) {
    this._connectionState = state;
    if (state === "connecting") {
      this._wasManualDisconnect = false;
    } else if (state === "disconnecting") {
      this._wasManualDisconnect = manual;
    }
  }
  /**
   * Perform the actual auth operation
   * @internal
   */
  async _performAuth(token = null) {
    let tokenToSend;
    let isManualToken = false;
    if (token) {
      tokenToSend = token;
      isManualToken = true;
    } else if (this.accessToken) {
      try {
        tokenToSend = await this.accessToken();
      } catch (e) {
        this.log("error", "Error fetching access token from callback", e);
        tokenToSend = this.accessTokenValue;
      }
    } else {
      tokenToSend = this.accessTokenValue;
    }
    if (isManualToken) {
      this._manuallySetToken = true;
    } else if (this.accessToken) {
      this._manuallySetToken = false;
    }
    if (this.accessTokenValue != tokenToSend) {
      this.accessTokenValue = tokenToSend;
      this.channels.forEach((channel) => {
        const payload = {
          access_token: tokenToSend,
          version: DEFAULT_VERSION
        };
        tokenToSend && channel.updateJoinPayload(payload);
        if (channel.joinedOnce && channel._isJoined()) {
          channel._push(CHANNEL_EVENTS.access_token, {
            access_token: tokenToSend
          });
        }
      });
    }
  }
  /**
   * Wait for any in-flight auth operations to complete
   * @internal
   */
  async _waitForAuthIfNeeded() {
    if (this._authPromise) {
      await this._authPromise;
    }
  }
  /**
   * Safely call setAuth with standardized error handling
   * @internal
   */
  _setAuthSafely(context = "general") {
    if (!this._isManualToken()) {
      this.setAuth().catch((e) => {
        this.log("error", `Error setting auth in ${context}`, e);
      });
    }
  }
  /**
   * Trigger state change callbacks with proper error handling
   * @internal
   */
  _triggerStateCallbacks(event, data) {
    try {
      this.stateChangeCallbacks[event].forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          this.log("error", `error in ${event} callback`, e);
        }
      });
    } catch (e) {
      this.log("error", `error triggering ${event} callbacks`, e);
    }
  }
  /**
   * Setup reconnection timer with proper configuration
   * @internal
   */
  _setupReconnectionTimer() {
    this.reconnectTimer = new Timer(async () => {
      setTimeout(async () => {
        await this._waitForAuthIfNeeded();
        if (!this.isConnected()) {
          this.connect();
        }
      }, CONNECTION_TIMEOUTS.RECONNECT_DELAY);
    }, this.reconnectAfterMs);
  }
  /**
   * Initialize client options with defaults
   * @internal
   */
  _initializeOptions(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    this.transport = (_a = options === null || options === void 0 ? void 0 : options.transport) !== null && _a !== void 0 ? _a : null;
    this.timeout = (_b = options === null || options === void 0 ? void 0 : options.timeout) !== null && _b !== void 0 ? _b : DEFAULT_TIMEOUT;
    this.heartbeatIntervalMs = (_c = options === null || options === void 0 ? void 0 : options.heartbeatIntervalMs) !== null && _c !== void 0 ? _c : CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL;
    this.worker = (_d = options === null || options === void 0 ? void 0 : options.worker) !== null && _d !== void 0 ? _d : false;
    this.accessToken = (_e = options === null || options === void 0 ? void 0 : options.accessToken) !== null && _e !== void 0 ? _e : null;
    this.heartbeatCallback = (_f = options === null || options === void 0 ? void 0 : options.heartbeatCallback) !== null && _f !== void 0 ? _f : noop2;
    this.vsn = (_g = options === null || options === void 0 ? void 0 : options.vsn) !== null && _g !== void 0 ? _g : DEFAULT_VSN;
    if (options === null || options === void 0 ? void 0 : options.params)
      this.params = options.params;
    if (options === null || options === void 0 ? void 0 : options.logger)
      this.logger = options.logger;
    if ((options === null || options === void 0 ? void 0 : options.logLevel) || (options === null || options === void 0 ? void 0 : options.log_level)) {
      this.logLevel = options.logLevel || options.log_level;
      this.params = Object.assign(Object.assign({}, this.params), { log_level: this.logLevel });
    }
    this.reconnectAfterMs = (_h = options === null || options === void 0 ? void 0 : options.reconnectAfterMs) !== null && _h !== void 0 ? _h : ((tries) => {
      return RECONNECT_INTERVALS[tries - 1] || DEFAULT_RECONNECT_FALLBACK;
    });
    switch (this.vsn) {
      case VSN_1_0_0:
        this.encode = (_j = options === null || options === void 0 ? void 0 : options.encode) !== null && _j !== void 0 ? _j : ((payload, callback) => {
          return callback(JSON.stringify(payload));
        });
        this.decode = (_k = options === null || options === void 0 ? void 0 : options.decode) !== null && _k !== void 0 ? _k : ((payload, callback) => {
          return callback(JSON.parse(payload));
        });
        break;
      case VSN_2_0_0:
        this.encode = (_l = options === null || options === void 0 ? void 0 : options.encode) !== null && _l !== void 0 ? _l : this.serializer.encode.bind(this.serializer);
        this.decode = (_m = options === null || options === void 0 ? void 0 : options.decode) !== null && _m !== void 0 ? _m : this.serializer.decode.bind(this.serializer);
        break;
      default:
        throw new Error(`Unsupported serializer version: ${this.vsn}`);
    }
    if (this.worker) {
      if (typeof window !== "undefined" && !window.Worker) {
        throw new Error("Web Worker is not supported");
      }
      this.workerUrl = options === null || options === void 0 ? void 0 : options.workerUrl;
    }
  }
};

// node_modules/iceberg-js/dist/index.mjs
var IcebergError = class extends Error {
  static {
    __name(this, "IcebergError");
  }
  constructor(message2, opts) {
    super(message2);
    this.name = "IcebergError";
    this.status = opts.status;
    this.icebergType = opts.icebergType;
    this.icebergCode = opts.icebergCode;
    this.details = opts.details;
    this.isCommitStateUnknown = opts.icebergType === "CommitStateUnknownException" || [500, 502, 504].includes(opts.status) && opts.icebergType?.includes("CommitState") === true;
  }
  /**
   * Returns true if the error is a 404 Not Found error.
   */
  isNotFound() {
    return this.status === 404;
  }
  /**
   * Returns true if the error is a 409 Conflict error.
   */
  isConflict() {
    return this.status === 409;
  }
  /**
   * Returns true if the error is a 419 Authentication Timeout error.
   */
  isAuthenticationTimeout() {
    return this.status === 419;
  }
};
function buildUrl(baseUrl, path, query) {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== void 0) {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}
__name(buildUrl, "buildUrl");
async function buildAuthHeaders(auth) {
  if (!auth || auth.type === "none") {
    return {};
  }
  if (auth.type === "bearer") {
    return { Authorization: `Bearer ${auth.token}` };
  }
  if (auth.type === "header") {
    return { [auth.name]: auth.value };
  }
  if (auth.type === "custom") {
    return await auth.getHeaders();
  }
  return {};
}
__name(buildAuthHeaders, "buildAuthHeaders");
function createFetchClient(options) {
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  return {
    async request({
      method,
      path,
      query,
      body,
      headers
    }) {
      const url = buildUrl(options.baseUrl, path, query);
      const authHeaders = await buildAuthHeaders(options.auth);
      const res = await fetchFn(url, {
        method,
        headers: {
          ...body ? { "Content-Type": "application/json" } : {},
          ...authHeaders,
          ...headers
        },
        body: body ? JSON.stringify(body) : void 0
      });
      const text = await res.text();
      const isJson = (res.headers.get("content-type") || "").includes("application/json");
      const data = isJson && text ? JSON.parse(text) : text;
      if (!res.ok) {
        const errBody = isJson ? data : void 0;
        const errorDetail = errBody?.error;
        throw new IcebergError(
          errorDetail?.message ?? `Request failed with status ${res.status}`,
          {
            status: res.status,
            icebergType: errorDetail?.type,
            icebergCode: errorDetail?.code,
            details: errBody
          }
        );
      }
      return { status: res.status, headers: res.headers, data };
    }
  };
}
__name(createFetchClient, "createFetchClient");
function namespaceToPath(namespace) {
  return namespace.join("");
}
__name(namespaceToPath, "namespaceToPath");
var NamespaceOperations = class {
  static {
    __name(this, "NamespaceOperations");
  }
  constructor(client, prefix = "") {
    this.client = client;
    this.prefix = prefix;
  }
  async listNamespaces(parent) {
    const query = parent ? { parent: namespaceToPath(parent.namespace) } : void 0;
    const response = await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces`,
      query
    });
    return response.data.namespaces.map((ns) => ({ namespace: ns }));
  }
  async createNamespace(id, metadata) {
    const request = {
      namespace: id.namespace,
      properties: metadata?.properties
    };
    const response = await this.client.request({
      method: "POST",
      path: `${this.prefix}/namespaces`,
      body: request
    });
    return response.data;
  }
  async dropNamespace(id) {
    await this.client.request({
      method: "DELETE",
      path: `${this.prefix}/namespaces/${namespaceToPath(id.namespace)}`
    });
  }
  async loadNamespaceMetadata(id) {
    const response = await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces/${namespaceToPath(id.namespace)}`
    });
    return {
      properties: response.data.properties
    };
  }
  async namespaceExists(id) {
    try {
      await this.client.request({
        method: "HEAD",
        path: `${this.prefix}/namespaces/${namespaceToPath(id.namespace)}`
      });
      return true;
    } catch (error) {
      if (error instanceof IcebergError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }
  async createNamespaceIfNotExists(id, metadata) {
    try {
      return await this.createNamespace(id, metadata);
    } catch (error) {
      if (error instanceof IcebergError && error.status === 409) {
        return;
      }
      throw error;
    }
  }
};
function namespaceToPath2(namespace) {
  return namespace.join("");
}
__name(namespaceToPath2, "namespaceToPath2");
var TableOperations = class {
  static {
    __name(this, "TableOperations");
  }
  constructor(client, prefix = "", accessDelegation) {
    this.client = client;
    this.prefix = prefix;
    this.accessDelegation = accessDelegation;
  }
  async listTables(namespace) {
    const response = await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces/${namespaceToPath2(namespace.namespace)}/tables`
    });
    return response.data.identifiers;
  }
  async createTable(namespace, request) {
    const headers = {};
    if (this.accessDelegation) {
      headers["X-Iceberg-Access-Delegation"] = this.accessDelegation;
    }
    const response = await this.client.request({
      method: "POST",
      path: `${this.prefix}/namespaces/${namespaceToPath2(namespace.namespace)}/tables`,
      body: request,
      headers
    });
    return response.data.metadata;
  }
  async updateTable(id, request) {
    const response = await this.client.request({
      method: "POST",
      path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
      body: request
    });
    return {
      "metadata-location": response.data["metadata-location"],
      metadata: response.data.metadata
    };
  }
  async dropTable(id, options) {
    await this.client.request({
      method: "DELETE",
      path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
      query: { purgeRequested: String(options?.purge ?? false) }
    });
  }
  async loadTable(id) {
    const headers = {};
    if (this.accessDelegation) {
      headers["X-Iceberg-Access-Delegation"] = this.accessDelegation;
    }
    const response = await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
      headers
    });
    return response.data.metadata;
  }
  async tableExists(id) {
    const headers = {};
    if (this.accessDelegation) {
      headers["X-Iceberg-Access-Delegation"] = this.accessDelegation;
    }
    try {
      await this.client.request({
        method: "HEAD",
        path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
        headers
      });
      return true;
    } catch (error) {
      if (error instanceof IcebergError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }
  async createTableIfNotExists(namespace, request) {
    try {
      return await this.createTable(namespace, request);
    } catch (error) {
      if (error instanceof IcebergError && error.status === 409) {
        return await this.loadTable({ namespace: namespace.namespace, name: request.name });
      }
      throw error;
    }
  }
};
var IcebergRestCatalog = class {
  static {
    __name(this, "IcebergRestCatalog");
  }
  /**
   * Creates a new Iceberg REST Catalog client.
   *
   * @param options - Configuration options for the catalog client
   */
  constructor(options) {
    let prefix = "v1";
    if (options.catalogName) {
      prefix += `/${options.catalogName}`;
    }
    const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
    this.client = createFetchClient({
      baseUrl,
      auth: options.auth,
      fetchImpl: options.fetch
    });
    this.accessDelegation = options.accessDelegation?.join(",");
    this.namespaceOps = new NamespaceOperations(this.client, prefix);
    this.tableOps = new TableOperations(this.client, prefix, this.accessDelegation);
  }
  /**
   * Lists all namespaces in the catalog.
   *
   * @param parent - Optional parent namespace to list children under
   * @returns Array of namespace identifiers
   *
   * @example
   * ```typescript
   * // List all top-level namespaces
   * const namespaces = await catalog.listNamespaces();
   *
   * // List namespaces under a parent
   * const children = await catalog.listNamespaces({ namespace: ['analytics'] });
   * ```
   */
  async listNamespaces(parent) {
    return this.namespaceOps.listNamespaces(parent);
  }
  /**
   * Creates a new namespace in the catalog.
   *
   * @param id - Namespace identifier to create
   * @param metadata - Optional metadata properties for the namespace
   * @returns Response containing the created namespace and its properties
   *
   * @example
   * ```typescript
   * const response = await catalog.createNamespace(
   *   { namespace: ['analytics'] },
   *   { properties: { owner: 'data-team' } }
   * );
   * console.log(response.namespace); // ['analytics']
   * console.log(response.properties); // { owner: 'data-team', ... }
   * ```
   */
  async createNamespace(id, metadata) {
    return this.namespaceOps.createNamespace(id, metadata);
  }
  /**
   * Drops a namespace from the catalog.
   *
   * The namespace must be empty (contain no tables) before it can be dropped.
   *
   * @param id - Namespace identifier to drop
   *
   * @example
   * ```typescript
   * await catalog.dropNamespace({ namespace: ['analytics'] });
   * ```
   */
  async dropNamespace(id) {
    await this.namespaceOps.dropNamespace(id);
  }
  /**
   * Loads metadata for a namespace.
   *
   * @param id - Namespace identifier to load
   * @returns Namespace metadata including properties
   *
   * @example
   * ```typescript
   * const metadata = await catalog.loadNamespaceMetadata({ namespace: ['analytics'] });
   * console.log(metadata.properties);
   * ```
   */
  async loadNamespaceMetadata(id) {
    return this.namespaceOps.loadNamespaceMetadata(id);
  }
  /**
   * Lists all tables in a namespace.
   *
   * @param namespace - Namespace identifier to list tables from
   * @returns Array of table identifiers
   *
   * @example
   * ```typescript
   * const tables = await catalog.listTables({ namespace: ['analytics'] });
   * console.log(tables); // [{ namespace: ['analytics'], name: 'events' }, ...]
   * ```
   */
  async listTables(namespace) {
    return this.tableOps.listTables(namespace);
  }
  /**
   * Creates a new table in the catalog.
   *
   * @param namespace - Namespace to create the table in
   * @param request - Table creation request including name, schema, partition spec, etc.
   * @returns Table metadata for the created table
   *
   * @example
   * ```typescript
   * const metadata = await catalog.createTable(
   *   { namespace: ['analytics'] },
   *   {
   *     name: 'events',
   *     schema: {
   *       type: 'struct',
   *       fields: [
   *         { id: 1, name: 'id', type: 'long', required: true },
   *         { id: 2, name: 'timestamp', type: 'timestamp', required: true }
   *       ],
   *       'schema-id': 0
   *     },
   *     'partition-spec': {
   *       'spec-id': 0,
   *       fields: [
   *         { source_id: 2, field_id: 1000, name: 'ts_day', transform: 'day' }
   *       ]
   *     }
   *   }
   * );
   * ```
   */
  async createTable(namespace, request) {
    return this.tableOps.createTable(namespace, request);
  }
  /**
   * Updates an existing table's metadata.
   *
   * Can update the schema, partition spec, or properties of a table.
   *
   * @param id - Table identifier to update
   * @param request - Update request with fields to modify
   * @returns Response containing the metadata location and updated table metadata
   *
   * @example
   * ```typescript
   * const response = await catalog.updateTable(
   *   { namespace: ['analytics'], name: 'events' },
   *   {
   *     properties: { 'read.split.target-size': '134217728' }
   *   }
   * );
   * console.log(response['metadata-location']); // s3://...
   * console.log(response.metadata); // TableMetadata object
   * ```
   */
  async updateTable(id, request) {
    return this.tableOps.updateTable(id, request);
  }
  /**
   * Drops a table from the catalog.
   *
   * @param id - Table identifier to drop
   *
   * @example
   * ```typescript
   * await catalog.dropTable({ namespace: ['analytics'], name: 'events' });
   * ```
   */
  async dropTable(id, options) {
    await this.tableOps.dropTable(id, options);
  }
  /**
   * Loads metadata for a table.
   *
   * @param id - Table identifier to load
   * @returns Table metadata including schema, partition spec, location, etc.
   *
   * @example
   * ```typescript
   * const metadata = await catalog.loadTable({ namespace: ['analytics'], name: 'events' });
   * console.log(metadata.schema);
   * console.log(metadata.location);
   * ```
   */
  async loadTable(id) {
    return this.tableOps.loadTable(id);
  }
  /**
   * Checks if a namespace exists in the catalog.
   *
   * @param id - Namespace identifier to check
   * @returns True if the namespace exists, false otherwise
   *
   * @example
   * ```typescript
   * const exists = await catalog.namespaceExists({ namespace: ['analytics'] });
   * console.log(exists); // true or false
   * ```
   */
  async namespaceExists(id) {
    return this.namespaceOps.namespaceExists(id);
  }
  /**
   * Checks if a table exists in the catalog.
   *
   * @param id - Table identifier to check
   * @returns True if the table exists, false otherwise
   *
   * @example
   * ```typescript
   * const exists = await catalog.tableExists({ namespace: ['analytics'], name: 'events' });
   * console.log(exists); // true or false
   * ```
   */
  async tableExists(id) {
    return this.tableOps.tableExists(id);
  }
  /**
   * Creates a namespace if it does not exist.
   *
   * If the namespace already exists, returns void. If created, returns the response.
   *
   * @param id - Namespace identifier to create
   * @param metadata - Optional metadata properties for the namespace
   * @returns Response containing the created namespace and its properties, or void if it already exists
   *
   * @example
   * ```typescript
   * const response = await catalog.createNamespaceIfNotExists(
   *   { namespace: ['analytics'] },
   *   { properties: { owner: 'data-team' } }
   * );
   * if (response) {
   *   console.log('Created:', response.namespace);
   * } else {
   *   console.log('Already exists');
   * }
   * ```
   */
  async createNamespaceIfNotExists(id, metadata) {
    return this.namespaceOps.createNamespaceIfNotExists(id, metadata);
  }
  /**
   * Creates a table if it does not exist.
   *
   * If the table already exists, returns its metadata instead.
   *
   * @param namespace - Namespace to create the table in
   * @param request - Table creation request including name, schema, partition spec, etc.
   * @returns Table metadata for the created or existing table
   *
   * @example
   * ```typescript
   * const metadata = await catalog.createTableIfNotExists(
   *   { namespace: ['analytics'] },
   *   {
   *     name: 'events',
   *     schema: {
   *       type: 'struct',
   *       fields: [
   *         { id: 1, name: 'id', type: 'long', required: true },
   *         { id: 2, name: 'timestamp', type: 'timestamp', required: true }
   *       ],
   *       'schema-id': 0
   *     }
   *   }
   * );
   * ```
   */
  async createTableIfNotExists(namespace, request) {
    return this.tableOps.createTableIfNotExists(namespace, request);
  }
};

// node_modules/@supabase/storage-js/dist/index.mjs
var StorageError = class extends Error {
  static {
    __name(this, "StorageError");
  }
  constructor(message2, namespace = "storage", status, statusCode) {
    super(message2);
    this.__isStorageError = true;
    this.namespace = namespace;
    this.name = namespace === "vectors" ? "StorageVectorsError" : "StorageError";
    this.status = status;
    this.statusCode = statusCode;
  }
};
function isStorageError(error) {
  return typeof error === "object" && error !== null && "__isStorageError" in error;
}
__name(isStorageError, "isStorageError");
var StorageApiError = class extends StorageError {
  static {
    __name(this, "StorageApiError");
  }
  constructor(message2, status, statusCode, namespace = "storage") {
    super(message2, namespace, status, statusCode);
    this.name = namespace === "vectors" ? "StorageVectorsApiError" : "StorageApiError";
    this.status = status;
    this.statusCode = statusCode;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusCode: this.statusCode
    };
  }
};
var StorageUnknownError = class extends StorageError {
  static {
    __name(this, "StorageUnknownError");
  }
  constructor(message2, originalError, namespace = "storage") {
    super(message2, namespace);
    this.name = namespace === "vectors" ? "StorageVectorsUnknownError" : "StorageUnknownError";
    this.originalError = originalError;
  }
};
var resolveFetch2 = /* @__PURE__ */ __name((customFetch) => {
  if (customFetch) return (...args) => customFetch(...args);
  return (...args) => fetch(...args);
}, "resolveFetch");
var isPlainObject = /* @__PURE__ */ __name((value) => {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}, "isPlainObject");
var recursiveToCamel = /* @__PURE__ */ __name((item) => {
  if (Array.isArray(item)) return item.map((el) => recursiveToCamel(el));
  else if (typeof item === "function" || item !== Object(item)) return item;
  const result = {};
  Object.entries(item).forEach(([key, value]) => {
    const newKey = key.replace(/([-_][a-z])/gi, (c) => c.toUpperCase().replace(/[-_]/g, ""));
    result[newKey] = recursiveToCamel(value);
  });
  return result;
}, "recursiveToCamel");
var isValidBucketName = /* @__PURE__ */ __name((bucketName) => {
  if (!bucketName || typeof bucketName !== "string") return false;
  if (bucketName.length === 0 || bucketName.length > 100) return false;
  if (bucketName.trim() !== bucketName) return false;
  if (bucketName.includes("/") || bucketName.includes("\\")) return false;
  return /^[\w!.\*'() &$@=;:+,?-]+$/.test(bucketName);
}, "isValidBucketName");
function _typeof2(o) {
  "@babel/helpers - typeof";
  return _typeof2 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
    return typeof o$1;
  } : function(o$1) {
    return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
  }, _typeof2(o);
}
__name(_typeof2, "_typeof");
function toPrimitive2(t, r) {
  if ("object" != _typeof2(t) || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != _typeof2(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
__name(toPrimitive2, "toPrimitive");
function toPropertyKey2(t) {
  var i = toPrimitive2(t, "string");
  return "symbol" == _typeof2(i) ? i : i + "";
}
__name(toPropertyKey2, "toPropertyKey");
function _defineProperty2(e, r, t) {
  return (r = toPropertyKey2(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
__name(_defineProperty2, "_defineProperty");
function ownKeys2(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r$1) {
      return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
__name(ownKeys2, "ownKeys");
function _objectSpread22(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys2(Object(t), true).forEach(function(r$1) {
      _defineProperty2(e, r$1, t[r$1]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys2(Object(t)).forEach(function(r$1) {
      Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t, r$1));
    });
  }
  return e;
}
__name(_objectSpread22, "_objectSpread2");
var _getErrorMessage = /* @__PURE__ */ __name((err) => {
  var _err$error;
  return err.msg || err.message || err.error_description || (typeof err.error === "string" ? err.error : (_err$error = err.error) === null || _err$error === void 0 ? void 0 : _err$error.message) || JSON.stringify(err);
}, "_getErrorMessage");
var handleError = /* @__PURE__ */ __name(async (error, reject, options, namespace) => {
  if (error && typeof error === "object" && "status" in error && "ok" in error && typeof error.status === "number" && !(options === null || options === void 0 ? void 0 : options.noResolveJson)) {
    const responseError = error;
    const status = responseError.status || 500;
    if (typeof responseError.json === "function") responseError.json().then((err) => {
      const statusCode = (err === null || err === void 0 ? void 0 : err.statusCode) || (err === null || err === void 0 ? void 0 : err.code) || status + "";
      reject(new StorageApiError(_getErrorMessage(err), status, statusCode, namespace));
    }).catch(() => {
      if (namespace === "vectors") {
        const statusCode = status + "";
        reject(new StorageApiError(responseError.statusText || `HTTP ${status} error`, status, statusCode, namespace));
      } else {
        const statusCode = status + "";
        reject(new StorageApiError(responseError.statusText || `HTTP ${status} error`, status, statusCode, namespace));
      }
    });
    else {
      const statusCode = status + "";
      reject(new StorageApiError(responseError.statusText || `HTTP ${status} error`, status, statusCode, namespace));
    }
  } else reject(new StorageUnknownError(_getErrorMessage(error), error, namespace));
}, "handleError");
var _getRequestParams = /* @__PURE__ */ __name((method, options, parameters, body) => {
  const params = {
    method,
    headers: (options === null || options === void 0 ? void 0 : options.headers) || {}
  };
  if (method === "GET" || method === "HEAD" || !body) return _objectSpread22(_objectSpread22({}, params), parameters);
  if (isPlainObject(body)) {
    params.headers = _objectSpread22({ "Content-Type": "application/json" }, options === null || options === void 0 ? void 0 : options.headers);
    params.body = JSON.stringify(body);
  } else params.body = body;
  if (options === null || options === void 0 ? void 0 : options.duplex) params.duplex = options.duplex;
  return _objectSpread22(_objectSpread22({}, params), parameters);
}, "_getRequestParams");
async function _handleRequest(fetcher, method, url, options, parameters, body, namespace) {
  return new Promise((resolve, reject) => {
    fetcher(url, _getRequestParams(method, options, parameters, body)).then((result) => {
      if (!result.ok) throw result;
      if (options === null || options === void 0 ? void 0 : options.noResolveJson) return result;
      if (namespace === "vectors") {
        const contentType = result.headers.get("content-type");
        if (result.headers.get("content-length") === "0" || result.status === 204) return {};
        if (!contentType || !contentType.includes("application/json")) return {};
      }
      return result.json();
    }).then((data) => resolve(data)).catch((error) => handleError(error, reject, options, namespace));
  });
}
__name(_handleRequest, "_handleRequest");
function createFetchApi(namespace = "storage") {
  return {
    get: /* @__PURE__ */ __name(async (fetcher, url, options, parameters) => {
      return _handleRequest(fetcher, "GET", url, options, parameters, void 0, namespace);
    }, "get"),
    post: /* @__PURE__ */ __name(async (fetcher, url, body, options, parameters) => {
      return _handleRequest(fetcher, "POST", url, options, parameters, body, namespace);
    }, "post"),
    put: /* @__PURE__ */ __name(async (fetcher, url, body, options, parameters) => {
      return _handleRequest(fetcher, "PUT", url, options, parameters, body, namespace);
    }, "put"),
    head: /* @__PURE__ */ __name(async (fetcher, url, options, parameters) => {
      return _handleRequest(fetcher, "HEAD", url, _objectSpread22(_objectSpread22({}, options), {}, { noResolveJson: true }), parameters, void 0, namespace);
    }, "head"),
    remove: /* @__PURE__ */ __name(async (fetcher, url, body, options, parameters) => {
      return _handleRequest(fetcher, "DELETE", url, options, parameters, body, namespace);
    }, "remove")
  };
}
__name(createFetchApi, "createFetchApi");
var defaultApi = createFetchApi("storage");
var { get, post, put, head, remove } = defaultApi;
var vectorsApi = createFetchApi("vectors");
var BaseApiClient = class {
  static {
    __name(this, "BaseApiClient");
  }
  /**
  * Creates a new BaseApiClient instance
  * @param url - Base URL for API requests
  * @param headers - Default headers for API requests
  * @param fetch - Optional custom fetch implementation
  * @param namespace - Error namespace ('storage' or 'vectors')
  */
  constructor(url, headers = {}, fetch$1, namespace = "storage") {
    this.shouldThrowOnError = false;
    this.url = url;
    this.headers = headers;
    this.fetch = resolveFetch2(fetch$1);
    this.namespace = namespace;
  }
  /**
  * Enable throwing errors instead of returning them.
  * When enabled, errors are thrown instead of returned in { data, error } format.
  *
  * @returns this - For method chaining
  */
  throwOnError() {
    this.shouldThrowOnError = true;
    return this;
  }
  /**
  * Set an HTTP header for the request.
  * Creates a shallow copy of headers to avoid mutating shared state.
  *
  * @param name - Header name
  * @param value - Header value
  * @returns this - For method chaining
  */
  setHeader(name, value) {
    this.headers = _objectSpread22(_objectSpread22({}, this.headers), {}, { [name]: value });
    return this;
  }
  /**
  * Handles API operation with standardized error handling
  * Eliminates repetitive try-catch blocks across all API methods
  *
  * This wrapper:
  * 1. Executes the operation
  * 2. Returns { data, error: null } on success
  * 3. Returns { data: null, error } on failure (if shouldThrowOnError is false)
  * 4. Throws error on failure (if shouldThrowOnError is true)
  *
  * @typeParam T - The expected data type from the operation
  * @param operation - Async function that performs the API call
  * @returns Promise with { data, error } tuple
  *
  * @example
  * ```typescript
  * async listBuckets() {
  *   return this.handleOperation(async () => {
  *     return await get(this.fetch, `${this.url}/bucket`, {
  *       headers: this.headers,
  *     })
  *   })
  * }
  * ```
  */
  async handleOperation(operation) {
    var _this = this;
    try {
      return {
        data: await operation(),
        error: null
      };
    } catch (error) {
      if (_this.shouldThrowOnError) throw error;
      if (isStorageError(error)) return {
        data: null,
        error
      };
      throw error;
    }
  }
};
var StreamDownloadBuilder = class {
  static {
    __name(this, "StreamDownloadBuilder");
  }
  constructor(downloadFn, shouldThrowOnError) {
    this.downloadFn = downloadFn;
    this.shouldThrowOnError = shouldThrowOnError;
  }
  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
  async execute() {
    var _this = this;
    try {
      return {
        data: (await _this.downloadFn()).body,
        error: null
      };
    } catch (error) {
      if (_this.shouldThrowOnError) throw error;
      if (isStorageError(error)) return {
        data: null,
        error
      };
      throw error;
    }
  }
};
var _Symbol$toStringTag;
_Symbol$toStringTag = Symbol.toStringTag;
var BlobDownloadBuilder = class {
  static {
    __name(this, "BlobDownloadBuilder");
  }
  constructor(downloadFn, shouldThrowOnError) {
    this.downloadFn = downloadFn;
    this.shouldThrowOnError = shouldThrowOnError;
    this[_Symbol$toStringTag] = "BlobDownloadBuilder";
    this.promise = null;
  }
  asStream() {
    return new StreamDownloadBuilder(this.downloadFn, this.shouldThrowOnError);
  }
  then(onfulfilled, onrejected) {
    return this.getPromise().then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this.getPromise().catch(onrejected);
  }
  finally(onfinally) {
    return this.getPromise().finally(onfinally);
  }
  getPromise() {
    if (!this.promise) this.promise = this.execute();
    return this.promise;
  }
  async execute() {
    var _this = this;
    try {
      return {
        data: await (await _this.downloadFn()).blob(),
        error: null
      };
    } catch (error) {
      if (_this.shouldThrowOnError) throw error;
      if (isStorageError(error)) return {
        data: null,
        error
      };
      throw error;
    }
  }
};
var DEFAULT_SEARCH_OPTIONS = {
  limit: 100,
  offset: 0,
  sortBy: {
    column: "name",
    order: "asc"
  }
};
var DEFAULT_FILE_OPTIONS = {
  cacheControl: "3600",
  contentType: "text/plain;charset=UTF-8",
  upsert: false
};
var StorageFileApi = class extends BaseApiClient {
  static {
    __name(this, "StorageFileApi");
  }
  constructor(url, headers = {}, bucketId, fetch$1) {
    super(url, headers, fetch$1, "storage");
    this.bucketId = bucketId;
  }
  /**
  * Uploads a file to an existing bucket or replaces an existing file at the specified path with a new one.
  *
  * @param method HTTP method.
  * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
  * @param fileBody The body of the file to be stored in the bucket.
  */
  async uploadOrUpdate(method, path, fileBody, fileOptions) {
    var _this = this;
    return _this.handleOperation(async () => {
      let body;
      const options = _objectSpread22(_objectSpread22({}, DEFAULT_FILE_OPTIONS), fileOptions);
      let headers = _objectSpread22(_objectSpread22({}, _this.headers), method === "POST" && { "x-upsert": String(options.upsert) });
      const metadata = options.metadata;
      if (typeof Blob !== "undefined" && fileBody instanceof Blob) {
        body = new FormData();
        body.append("cacheControl", options.cacheControl);
        if (metadata) body.append("metadata", _this.encodeMetadata(metadata));
        body.append("", fileBody);
      } else if (typeof FormData !== "undefined" && fileBody instanceof FormData) {
        body = fileBody;
        if (!body.has("cacheControl")) body.append("cacheControl", options.cacheControl);
        if (metadata && !body.has("metadata")) body.append("metadata", _this.encodeMetadata(metadata));
      } else {
        body = fileBody;
        headers["cache-control"] = `max-age=${options.cacheControl}`;
        headers["content-type"] = options.contentType;
        if (metadata) headers["x-metadata"] = _this.toBase64(_this.encodeMetadata(metadata));
        if ((typeof ReadableStream !== "undefined" && body instanceof ReadableStream || body && typeof body === "object" && "pipe" in body && typeof body.pipe === "function") && !options.duplex) options.duplex = "half";
      }
      if (fileOptions === null || fileOptions === void 0 ? void 0 : fileOptions.headers) headers = _objectSpread22(_objectSpread22({}, headers), fileOptions.headers);
      const cleanPath = _this._removeEmptyFolders(path);
      const _path = _this._getFinalPath(cleanPath);
      const data = await (method == "PUT" ? put : post)(_this.fetch, `${_this.url}/object/${_path}`, body, _objectSpread22({ headers }, (options === null || options === void 0 ? void 0 : options.duplex) ? { duplex: options.duplex } : {}));
      return {
        path: cleanPath,
        id: data.Id,
        fullPath: data.Key
      };
    });
  }
  /**
  * Uploads a file to an existing bucket.
  *
  * @category File Buckets
  * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
  * @param fileBody The body of the file to be stored in the bucket.
  * @param fileOptions Optional file upload options including cacheControl, contentType, upsert, and metadata.
  * @returns Promise with response containing file path, id, and fullPath or error
  *
  * @example Upload file
  * ```js
  * const avatarFile = event.target.files[0]
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .upload('public/avatar1.png', avatarFile, {
  *     cacheControl: '3600',
  *     upsert: false
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "public/avatar1.png",
  *     "fullPath": "avatars/public/avatar1.png"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @example Upload file using `ArrayBuffer` from base64 file data
  * ```js
  * import { decode } from 'base64-arraybuffer'
  *
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .upload('public/avatar1.png', decode('base64FileData'), {
  *     contentType: 'image/png'
  *   })
  * ```
  */
  async upload(path, fileBody, fileOptions) {
    return this.uploadOrUpdate("POST", path, fileBody, fileOptions);
  }
  /**
  * Upload a file with a token generated from `createSignedUploadUrl`.
  *
  * @category File Buckets
  * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
  * @param token The token generated from `createSignedUploadUrl`
  * @param fileBody The body of the file to be stored in the bucket.
  * @param fileOptions HTTP headers (cacheControl, contentType, etc.).
  * **Note:** The `upsert` option has no effect here. To enable upsert behavior,
  * pass `{ upsert: true }` when calling `createSignedUploadUrl()` instead.
  * @returns Promise with response containing file path and fullPath or error
  *
  * @example Upload to a signed URL
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .uploadToSignedUrl('folder/cat.jpg', 'token-from-createSignedUploadUrl', file)
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "folder/cat.jpg",
  *     "fullPath": "avatars/folder/cat.jpg"
  *   },
  *   "error": null
  * }
  * ```
  */
  async uploadToSignedUrl(path, token, fileBody, fileOptions) {
    var _this3 = this;
    const cleanPath = _this3._removeEmptyFolders(path);
    const _path = _this3._getFinalPath(cleanPath);
    const url = new URL(_this3.url + `/object/upload/sign/${_path}`);
    url.searchParams.set("token", token);
    return _this3.handleOperation(async () => {
      let body;
      const options = _objectSpread22({ upsert: DEFAULT_FILE_OPTIONS.upsert }, fileOptions);
      const headers = _objectSpread22(_objectSpread22({}, _this3.headers), { "x-upsert": String(options.upsert) });
      if (typeof Blob !== "undefined" && fileBody instanceof Blob) {
        body = new FormData();
        body.append("cacheControl", options.cacheControl);
        body.append("", fileBody);
      } else if (typeof FormData !== "undefined" && fileBody instanceof FormData) {
        body = fileBody;
        body.append("cacheControl", options.cacheControl);
      } else {
        body = fileBody;
        headers["cache-control"] = `max-age=${options.cacheControl}`;
        headers["content-type"] = options.contentType;
      }
      return {
        path: cleanPath,
        fullPath: (await put(_this3.fetch, url.toString(), body, { headers })).Key
      };
    });
  }
  /**
  * Creates a signed upload URL.
  * Signed upload URLs can be used to upload files to the bucket without further authentication.
  * They are valid for 2 hours.
  *
  * @category File Buckets
  * @param path The file path, including the current file name. For example `folder/image.png`.
  * @param options.upsert If set to true, allows the file to be overwritten if it already exists.
  * @returns Promise with response containing signed upload URL, token, and path or error
  *
  * @example Create Signed Upload URL
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUploadUrl('folder/cat.jpg')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "signedUrl": "https://example.supabase.co/storage/v1/object/upload/sign/avatars/folder/cat.jpg?token=<TOKEN>",
  *     "path": "folder/cat.jpg",
  *     "token": "<TOKEN>"
  *   },
  *   "error": null
  * }
  * ```
  */
  async createSignedUploadUrl(path, options) {
    var _this4 = this;
    return _this4.handleOperation(async () => {
      let _path = _this4._getFinalPath(path);
      const headers = _objectSpread22({}, _this4.headers);
      if (options === null || options === void 0 ? void 0 : options.upsert) headers["x-upsert"] = "true";
      const data = await post(_this4.fetch, `${_this4.url}/object/upload/sign/${_path}`, {}, { headers });
      const url = new URL(_this4.url + data.url);
      const token = url.searchParams.get("token");
      if (!token) throw new StorageError("No token returned by API");
      return {
        signedUrl: url.toString(),
        path,
        token
      };
    });
  }
  /**
  * Replaces an existing file at the specified path with a new one.
  *
  * @category File Buckets
  * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to update.
  * @param fileBody The body of the file to be stored in the bucket.
  * @param fileOptions Optional file upload options including cacheControl, contentType, upsert, and metadata.
  * @returns Promise with response containing file path, id, and fullPath or error
  *
  * @example Update file
  * ```js
  * const avatarFile = event.target.files[0]
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .update('public/avatar1.png', avatarFile, {
  *     cacheControl: '3600',
  *     upsert: true
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "public/avatar1.png",
  *     "fullPath": "avatars/public/avatar1.png"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @example Update file using `ArrayBuffer` from base64 file data
  * ```js
  * import {decode} from 'base64-arraybuffer'
  *
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .update('public/avatar1.png', decode('base64FileData'), {
  *     contentType: 'image/png'
  *   })
  * ```
  */
  async update(path, fileBody, fileOptions) {
    return this.uploadOrUpdate("PUT", path, fileBody, fileOptions);
  }
  /**
  * Moves an existing file to a new path in the same bucket.
  *
  * @category File Buckets
  * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
  * @param toPath The new file path, including the new file name. For example `folder/image-new.png`.
  * @param options The destination options.
  * @returns Promise with response containing success message or error
  *
  * @example Move file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .move('public/avatar1.png', 'private/avatar2.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully moved"
  *   },
  *   "error": null
  * }
  * ```
  */
  async move(fromPath, toPath, options) {
    var _this6 = this;
    return _this6.handleOperation(async () => {
      return await post(_this6.fetch, `${_this6.url}/object/move`, {
        bucketId: _this6.bucketId,
        sourceKey: fromPath,
        destinationKey: toPath,
        destinationBucket: options === null || options === void 0 ? void 0 : options.destinationBucket
      }, { headers: _this6.headers });
    });
  }
  /**
  * Copies an existing file to a new path in the same bucket.
  *
  * @category File Buckets
  * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
  * @param toPath The new file path, including the new file name. For example `folder/image-copy.png`.
  * @param options The destination options.
  * @returns Promise with response containing copied file path or error
  *
  * @example Copy file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .copy('public/avatar1.png', 'private/avatar2.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "avatars/private/avatar2.png"
  *   },
  *   "error": null
  * }
  * ```
  */
  async copy(fromPath, toPath, options) {
    var _this7 = this;
    return _this7.handleOperation(async () => {
      return { path: (await post(_this7.fetch, `${_this7.url}/object/copy`, {
        bucketId: _this7.bucketId,
        sourceKey: fromPath,
        destinationKey: toPath,
        destinationBucket: options === null || options === void 0 ? void 0 : options.destinationBucket
      }, { headers: _this7.headers })).Key };
    });
  }
  /**
  * Creates a signed URL. Use a signed URL to share a file for a fixed amount of time.
  *
  * @category File Buckets
  * @param path The file path, including the current file name. For example `folder/image.png`.
  * @param expiresIn The number of seconds until the signed URL expires. For example, `60` for a URL which is valid for one minute.
  * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
  * @param options.transform Transform the asset before serving it to the client.
  * @returns Promise with response containing signed URL or error
  *
  * @example Create Signed URL
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrl('folder/avatar1.png', 60)
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar1.png?token=<TOKEN>"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @example Create a signed URL for an asset with transformations
  * ```js
  * const { data } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrl('folder/avatar1.png', 60, {
  *     transform: {
  *       width: 100,
  *       height: 100,
  *     }
  *   })
  * ```
  *
  * @example Create a signed URL which triggers the download of the asset
  * ```js
  * const { data } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrl('folder/avatar1.png', 60, {
  *     download: true,
  *   })
  * ```
  */
  async createSignedUrl(path, expiresIn, options) {
    var _this8 = this;
    return _this8.handleOperation(async () => {
      let _path = _this8._getFinalPath(path);
      let data = await post(_this8.fetch, `${_this8.url}/object/sign/${_path}`, _objectSpread22({ expiresIn }, (options === null || options === void 0 ? void 0 : options.transform) ? { transform: options.transform } : {}), { headers: _this8.headers });
      const downloadQueryParam = (options === null || options === void 0 ? void 0 : options.download) ? `&download=${options.download === true ? "" : options.download}` : "";
      return { signedUrl: encodeURI(`${_this8.url}${data.signedURL}${downloadQueryParam}`) };
    });
  }
  /**
  * Creates multiple signed URLs. Use a signed URL to share a file for a fixed amount of time.
  *
  * @category File Buckets
  * @param paths The file paths to be downloaded, including the current file names. For example `['folder/image.png', 'folder2/image2.png']`.
  * @param expiresIn The number of seconds until the signed URLs expire. For example, `60` for URLs which are valid for one minute.
  * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
  * @returns Promise with response containing array of objects with signedUrl, path, and error or error
  *
  * @example Create Signed URLs
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrls(['folder/avatar1.png', 'folder/avatar2.png'], 60)
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [
  *     {
  *       "error": null,
  *       "path": "folder/avatar1.png",
  *       "signedURL": "/object/sign/avatars/folder/avatar1.png?token=<TOKEN>",
  *       "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar1.png?token=<TOKEN>"
  *     },
  *     {
  *       "error": null,
  *       "path": "folder/avatar2.png",
  *       "signedURL": "/object/sign/avatars/folder/avatar2.png?token=<TOKEN>",
  *       "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar2.png?token=<TOKEN>"
  *     }
  *   ],
  *   "error": null
  * }
  * ```
  */
  async createSignedUrls(paths, expiresIn, options) {
    var _this9 = this;
    return _this9.handleOperation(async () => {
      const data = await post(_this9.fetch, `${_this9.url}/object/sign/${_this9.bucketId}`, {
        expiresIn,
        paths
      }, { headers: _this9.headers });
      const downloadQueryParam = (options === null || options === void 0 ? void 0 : options.download) ? `&download=${options.download === true ? "" : options.download}` : "";
      return data.map((datum) => _objectSpread22(_objectSpread22({}, datum), {}, { signedUrl: datum.signedURL ? encodeURI(`${_this9.url}${datum.signedURL}${downloadQueryParam}`) : null }));
    });
  }
  /**
  * Downloads a file from a private bucket. For public buckets, make a request to the URL returned from `getPublicUrl` instead.
  *
  * @category File Buckets
  * @param path The full path and file name of the file to be downloaded. For example `folder/image.png`.
  * @param options.transform Transform the asset before serving it to the client.
  * @param parameters Additional fetch parameters like signal for cancellation. Supports standard fetch options including cache control.
  * @returns BlobDownloadBuilder instance for downloading the file
  *
  * @example Download file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": <BLOB>,
  *   "error": null
  * }
  * ```
  *
  * @example Download file with transformations
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png', {
  *     transform: {
  *       width: 100,
  *       height: 100,
  *       quality: 80
  *     }
  *   })
  * ```
  *
  * @example Download with cache control (useful in Edge Functions)
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png', {}, { cache: 'no-store' })
  * ```
  *
  * @example Download with abort signal
  * ```js
  * const controller = new AbortController()
  * setTimeout(() => controller.abort(), 5000)
  *
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png', {}, { signal: controller.signal })
  * ```
  */
  download(path, options, parameters) {
    const renderPath = typeof (options === null || options === void 0 ? void 0 : options.transform) !== "undefined" ? "render/image/authenticated" : "object";
    const transformationQuery = this.transformOptsToQueryString((options === null || options === void 0 ? void 0 : options.transform) || {});
    const queryString = transformationQuery ? `?${transformationQuery}` : "";
    const _path = this._getFinalPath(path);
    const downloadFn = /* @__PURE__ */ __name(() => get(this.fetch, `${this.url}/${renderPath}/${_path}${queryString}`, {
      headers: this.headers,
      noResolveJson: true
    }, parameters), "downloadFn");
    return new BlobDownloadBuilder(downloadFn, this.shouldThrowOnError);
  }
  /**
  * Retrieves the details of an existing file.
  *
  * @category File Buckets
  * @param path The file path, including the file name. For example `folder/image.png`.
  * @returns Promise with response containing file metadata or error
  *
  * @example Get file info
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .info('folder/avatar1.png')
  * ```
  */
  async info(path) {
    var _this10 = this;
    const _path = _this10._getFinalPath(path);
    return _this10.handleOperation(async () => {
      return recursiveToCamel(await get(_this10.fetch, `${_this10.url}/object/info/${_path}`, { headers: _this10.headers }));
    });
  }
  /**
  * Checks the existence of a file.
  *
  * @category File Buckets
  * @param path The file path, including the file name. For example `folder/image.png`.
  * @returns Promise with response containing boolean indicating file existence or error
  *
  * @example Check file existence
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .exists('folder/avatar1.png')
  * ```
  */
  async exists(path) {
    var _this11 = this;
    const _path = _this11._getFinalPath(path);
    try {
      await head(_this11.fetch, `${_this11.url}/object/${_path}`, { headers: _this11.headers });
      return {
        data: true,
        error: null
      };
    } catch (error) {
      if (_this11.shouldThrowOnError) throw error;
      if (isStorageError(error) && error instanceof StorageUnknownError) {
        const originalError = error.originalError;
        if ([400, 404].includes(originalError === null || originalError === void 0 ? void 0 : originalError.status)) return {
          data: false,
          error
        };
      }
      throw error;
    }
  }
  /**
  * A simple convenience function to get the URL for an asset in a public bucket. If you do not want to use this function, you can construct the public URL by concatenating the bucket URL with the path to the asset.
  * This function does not verify if the bucket is public. If a public URL is created for a bucket which is not public, you will not be able to download the asset.
  *
  * @category File Buckets
  * @param path The path and name of the file to generate the public URL for. For example `folder/image.png`.
  * @param options.download Triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
  * @param options.transform Transform the asset before serving it to the client.
  * @returns Object with public URL
  *
  * @example Returns the URL for an asset in a public bucket
  * ```js
  * const { data } = supabase
  *   .storage
  *   .from('public-bucket')
  *   .getPublicUrl('folder/avatar1.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "publicUrl": "https://example.supabase.co/storage/v1/object/public/public-bucket/folder/avatar1.png"
  *   }
  * }
  * ```
  *
  * @example Returns the URL for an asset in a public bucket with transformations
  * ```js
  * const { data } = supabase
  *   .storage
  *   .from('public-bucket')
  *   .getPublicUrl('folder/avatar1.png', {
  *     transform: {
  *       width: 100,
  *       height: 100,
  *     }
  *   })
  * ```
  *
  * @example Returns the URL which triggers the download of an asset in a public bucket
  * ```js
  * const { data } = supabase
  *   .storage
  *   .from('public-bucket')
  *   .getPublicUrl('folder/avatar1.png', {
  *     download: true,
  *   })
  * ```
  */
  getPublicUrl(path, options) {
    const _path = this._getFinalPath(path);
    const _queryString = [];
    const downloadQueryParam = (options === null || options === void 0 ? void 0 : options.download) ? `download=${options.download === true ? "" : options.download}` : "";
    if (downloadQueryParam !== "") _queryString.push(downloadQueryParam);
    const renderPath = typeof (options === null || options === void 0 ? void 0 : options.transform) !== "undefined" ? "render/image" : "object";
    const transformationQuery = this.transformOptsToQueryString((options === null || options === void 0 ? void 0 : options.transform) || {});
    if (transformationQuery !== "") _queryString.push(transformationQuery);
    let queryString = _queryString.join("&");
    if (queryString !== "") queryString = `?${queryString}`;
    return { data: { publicUrl: encodeURI(`${this.url}/${renderPath}/public/${_path}${queryString}`) } };
  }
  /**
  * Deletes files within the same bucket
  *
  * @category File Buckets
  * @param paths An array of files to delete, including the path and file name. For example [`'folder/image.png'`].
  * @returns Promise with response containing array of deleted file objects or error
  *
  * @example Delete file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .remove(['folder/avatar1.png'])
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [],
  *   "error": null
  * }
  * ```
  */
  async remove(paths) {
    var _this12 = this;
    return _this12.handleOperation(async () => {
      return await remove(_this12.fetch, `${_this12.url}/object/${_this12.bucketId}`, { prefixes: paths }, { headers: _this12.headers });
    });
  }
  /**
  * Get file metadata
  * @param id the file id to retrieve metadata
  */
  /**
  * Update file metadata
  * @param id the file id to update metadata
  * @param meta the new file metadata
  */
  /**
  * Lists all the files and folders within a path of the bucket.
  *
  * @category File Buckets
  * @param path The folder path.
  * @param options Search options including limit (defaults to 100), offset, sortBy, and search
  * @param parameters Optional fetch parameters including signal for cancellation
  * @returns Promise with response containing array of files or error
  *
  * @example List files in a bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .list('folder', {
  *     limit: 100,
  *     offset: 0,
  *     sortBy: { column: 'name', order: 'asc' },
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "avatar1.png",
  *       "id": "e668cf7f-821b-4a2f-9dce-7dfa5dd1cfd2",
  *       "updated_at": "2024-05-22T23:06:05.580Z",
  *       "created_at": "2024-05-22T23:04:34.443Z",
  *       "last_accessed_at": "2024-05-22T23:04:34.443Z",
  *       "metadata": {
  *         "eTag": "\"c5e8c553235d9af30ef4f6e280790b92\"",
  *         "size": 32175,
  *         "mimetype": "image/png",
  *         "cacheControl": "max-age=3600",
  *         "lastModified": "2024-05-22T23:06:05.574Z",
  *         "contentLength": 32175,
  *         "httpStatusCode": 200
  *       }
  *     }
  *   ],
  *   "error": null
  * }
  * ```
  *
  * @example Search files in a bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .list('folder', {
  *     limit: 100,
  *     offset: 0,
  *     sortBy: { column: 'name', order: 'asc' },
  *     search: 'jon'
  *   })
  * ```
  */
  async list(path, options, parameters) {
    var _this13 = this;
    return _this13.handleOperation(async () => {
      const body = _objectSpread22(_objectSpread22(_objectSpread22({}, DEFAULT_SEARCH_OPTIONS), options), {}, { prefix: path || "" });
      return await post(_this13.fetch, `${_this13.url}/object/list/${_this13.bucketId}`, body, { headers: _this13.headers }, parameters);
    });
  }
  /**
  * @experimental this method signature might change in the future
  *
  * @category File Buckets
  * @param options search options
  * @param parameters
  */
  async listV2(options, parameters) {
    var _this14 = this;
    return _this14.handleOperation(async () => {
      const body = _objectSpread22({}, options);
      return await post(_this14.fetch, `${_this14.url}/object/list-v2/${_this14.bucketId}`, body, { headers: _this14.headers }, parameters);
    });
  }
  encodeMetadata(metadata) {
    return JSON.stringify(metadata);
  }
  toBase64(data) {
    if (typeof Buffer !== "undefined") return Buffer.from(data).toString("base64");
    return btoa(data);
  }
  _getFinalPath(path) {
    return `${this.bucketId}/${path.replace(/^\/+/, "")}`;
  }
  _removeEmptyFolders(path) {
    return path.replace(/^\/|\/$/g, "").replace(/\/+/g, "/");
  }
  transformOptsToQueryString(transform) {
    const params = [];
    if (transform.width) params.push(`width=${transform.width}`);
    if (transform.height) params.push(`height=${transform.height}`);
    if (transform.resize) params.push(`resize=${transform.resize}`);
    if (transform.format) params.push(`format=${transform.format}`);
    if (transform.quality) params.push(`quality=${transform.quality}`);
    return params.join("&");
  }
};
var version2 = "2.97.0";
var DEFAULT_HEADERS = { "X-Client-Info": `storage-js/${version2}` };
var StorageBucketApi = class extends BaseApiClient {
  static {
    __name(this, "StorageBucketApi");
  }
  constructor(url, headers = {}, fetch$1, opts) {
    const baseUrl = new URL(url);
    if (opts === null || opts === void 0 ? void 0 : opts.useNewHostname) {
      if (/supabase\.(co|in|red)$/.test(baseUrl.hostname) && !baseUrl.hostname.includes("storage.supabase.")) baseUrl.hostname = baseUrl.hostname.replace("supabase.", "storage.supabase.");
    }
    const finalUrl = baseUrl.href.replace(/\/$/, "");
    const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), headers);
    super(finalUrl, finalHeaders, fetch$1, "storage");
  }
  /**
  * Retrieves the details of all Storage buckets within an existing project.
  *
  * @category File Buckets
  * @param options Query parameters for listing buckets
  * @param options.limit Maximum number of buckets to return
  * @param options.offset Number of buckets to skip
  * @param options.sortColumn Column to sort by ('id', 'name', 'created_at', 'updated_at')
  * @param options.sortOrder Sort order ('asc' or 'desc')
  * @param options.search Search term to filter bucket names
  * @returns Promise with response containing array of buckets or error
  *
  * @example List buckets
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .listBuckets()
  * ```
  *
  * @example List buckets with options
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .listBuckets({
  *     limit: 10,
  *     offset: 0,
  *     sortColumn: 'created_at',
  *     sortOrder: 'desc',
  *     search: 'prod'
  *   })
  * ```
  */
  async listBuckets(options) {
    var _this = this;
    return _this.handleOperation(async () => {
      const queryString = _this.listBucketOptionsToQueryString(options);
      return await get(_this.fetch, `${_this.url}/bucket${queryString}`, { headers: _this.headers });
    });
  }
  /**
  * Retrieves the details of an existing Storage bucket.
  *
  * @category File Buckets
  * @param id The unique identifier of the bucket you would like to retrieve.
  * @returns Promise with response containing bucket details or error
  *
  * @example Get bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .getBucket('avatars')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "id": "avatars",
  *     "name": "avatars",
  *     "owner": "",
  *     "public": false,
  *     "file_size_limit": 1024,
  *     "allowed_mime_types": [
  *       "image/png"
  *     ],
  *     "created_at": "2024-05-22T22:26:05.100Z",
  *     "updated_at": "2024-05-22T22:26:05.100Z"
  *   },
  *   "error": null
  * }
  * ```
  */
  async getBucket(id) {
    var _this2 = this;
    return _this2.handleOperation(async () => {
      return await get(_this2.fetch, `${_this2.url}/bucket/${id}`, { headers: _this2.headers });
    });
  }
  /**
  * Creates a new Storage bucket
  *
  * @category File Buckets
  * @param id A unique identifier for the bucket you are creating.
  * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations. By default, buckets are private.
  * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
  * The global file size limit takes precedence over this value.
  * The default value is null, which doesn't set a per bucket file size limit.
  * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
  * The default value is null, which allows files with all mime types to be uploaded.
  * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
  * @param options.type (private-beta) specifies the bucket type. see `BucketType` for more details.
  *   - default bucket type is `STANDARD`
  * @returns Promise with response containing newly created bucket name or error
  *
  * @example Create bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .createBucket('avatars', {
  *     public: false,
  *     allowedMimeTypes: ['image/png'],
  *     fileSizeLimit: 1024
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "name": "avatars"
  *   },
  *   "error": null
  * }
  * ```
  */
  async createBucket(id, options = { public: false }) {
    var _this3 = this;
    return _this3.handleOperation(async () => {
      return await post(_this3.fetch, `${_this3.url}/bucket`, {
        id,
        name: id,
        type: options.type,
        public: options.public,
        file_size_limit: options.fileSizeLimit,
        allowed_mime_types: options.allowedMimeTypes
      }, { headers: _this3.headers });
    });
  }
  /**
  * Updates a Storage bucket
  *
  * @category File Buckets
  * @param id A unique identifier for the bucket you are updating.
  * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations.
  * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
  * The global file size limit takes precedence over this value.
  * The default value is null, which doesn't set a per bucket file size limit.
  * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
  * The default value is null, which allows files with all mime types to be uploaded.
  * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
  * @returns Promise with response containing success message or error
  *
  * @example Update bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .updateBucket('avatars', {
  *     public: false,
  *     allowedMimeTypes: ['image/png'],
  *     fileSizeLimit: 1024
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully updated"
  *   },
  *   "error": null
  * }
  * ```
  */
  async updateBucket(id, options) {
    var _this4 = this;
    return _this4.handleOperation(async () => {
      return await put(_this4.fetch, `${_this4.url}/bucket/${id}`, {
        id,
        name: id,
        public: options.public,
        file_size_limit: options.fileSizeLimit,
        allowed_mime_types: options.allowedMimeTypes
      }, { headers: _this4.headers });
    });
  }
  /**
  * Removes all objects inside a single bucket.
  *
  * @category File Buckets
  * @param id The unique identifier of the bucket you would like to empty.
  * @returns Promise with success message or error
  *
  * @example Empty bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .emptyBucket('avatars')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully emptied"
  *   },
  *   "error": null
  * }
  * ```
  */
  async emptyBucket(id) {
    var _this5 = this;
    return _this5.handleOperation(async () => {
      return await post(_this5.fetch, `${_this5.url}/bucket/${id}/empty`, {}, { headers: _this5.headers });
    });
  }
  /**
  * Deletes an existing bucket. A bucket can't be deleted with existing objects inside it.
  * You must first `empty()` the bucket.
  *
  * @category File Buckets
  * @param id The unique identifier of the bucket you would like to delete.
  * @returns Promise with success message or error
  *
  * @example Delete bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .deleteBucket('avatars')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully deleted"
  *   },
  *   "error": null
  * }
  * ```
  */
  async deleteBucket(id) {
    var _this6 = this;
    return _this6.handleOperation(async () => {
      return await remove(_this6.fetch, `${_this6.url}/bucket/${id}`, {}, { headers: _this6.headers });
    });
  }
  listBucketOptionsToQueryString(options) {
    const params = {};
    if (options) {
      if ("limit" in options) params.limit = String(options.limit);
      if ("offset" in options) params.offset = String(options.offset);
      if (options.search) params.search = options.search;
      if (options.sortColumn) params.sortColumn = options.sortColumn;
      if (options.sortOrder) params.sortOrder = options.sortOrder;
    }
    return Object.keys(params).length > 0 ? "?" + new URLSearchParams(params).toString() : "";
  }
};
var StorageAnalyticsClient = class extends BaseApiClient {
  static {
    __name(this, "StorageAnalyticsClient");
  }
  /**
  * @alpha
  *
  * Creates a new StorageAnalyticsClient instance
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param url - The base URL for the storage API
  * @param headers - HTTP headers to include in requests
  * @param fetch - Optional custom fetch implementation
  *
  * @example
  * ```typescript
  * const client = new StorageAnalyticsClient(url, headers)
  * ```
  */
  constructor(url, headers = {}, fetch$1) {
    const finalUrl = url.replace(/\/$/, "");
    const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), headers);
    super(finalUrl, finalHeaders, fetch$1, "storage");
  }
  /**
  * @alpha
  *
  * Creates a new analytics bucket using Iceberg tables
  * Analytics buckets are optimized for analytical queries and data processing
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param name A unique name for the bucket you are creating
  * @returns Promise with response containing newly created analytics bucket or error
  *
  * @example Create analytics bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .analytics
  *   .createBucket('analytics-data')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "name": "analytics-data",
  *     "type": "ANALYTICS",
  *     "format": "iceberg",
  *     "created_at": "2024-05-22T22:26:05.100Z",
  *     "updated_at": "2024-05-22T22:26:05.100Z"
  *   },
  *   "error": null
  * }
  * ```
  */
  async createBucket(name) {
    var _this = this;
    return _this.handleOperation(async () => {
      return await post(_this.fetch, `${_this.url}/bucket`, { name }, { headers: _this.headers });
    });
  }
  /**
  * @alpha
  *
  * Retrieves the details of all Analytics Storage buckets within an existing project
  * Only returns buckets of type 'ANALYTICS'
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param options Query parameters for listing buckets
  * @param options.limit Maximum number of buckets to return
  * @param options.offset Number of buckets to skip
  * @param options.sortColumn Column to sort by ('name', 'created_at', 'updated_at')
  * @param options.sortOrder Sort order ('asc' or 'desc')
  * @param options.search Search term to filter bucket names
  * @returns Promise with response containing array of analytics buckets or error
  *
  * @example List analytics buckets
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .analytics
  *   .listBuckets({
  *     limit: 10,
  *     offset: 0,
  *     sortColumn: 'created_at',
  *     sortOrder: 'desc'
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "analytics-data",
  *       "type": "ANALYTICS",
  *       "format": "iceberg",
  *       "created_at": "2024-05-22T22:26:05.100Z",
  *       "updated_at": "2024-05-22T22:26:05.100Z"
  *     }
  *   ],
  *   "error": null
  * }
  * ```
  */
  async listBuckets(options) {
    var _this2 = this;
    return _this2.handleOperation(async () => {
      const queryParams = new URLSearchParams();
      if ((options === null || options === void 0 ? void 0 : options.limit) !== void 0) queryParams.set("limit", options.limit.toString());
      if ((options === null || options === void 0 ? void 0 : options.offset) !== void 0) queryParams.set("offset", options.offset.toString());
      if (options === null || options === void 0 ? void 0 : options.sortColumn) queryParams.set("sortColumn", options.sortColumn);
      if (options === null || options === void 0 ? void 0 : options.sortOrder) queryParams.set("sortOrder", options.sortOrder);
      if (options === null || options === void 0 ? void 0 : options.search) queryParams.set("search", options.search);
      const queryString = queryParams.toString();
      const url = queryString ? `${_this2.url}/bucket?${queryString}` : `${_this2.url}/bucket`;
      return await get(_this2.fetch, url, { headers: _this2.headers });
    });
  }
  /**
  * @alpha
  *
  * Deletes an existing analytics bucket
  * A bucket can't be deleted with existing objects inside it
  * You must first empty the bucket before deletion
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param bucketName The unique identifier of the bucket you would like to delete
  * @returns Promise with response containing success message or error
  *
  * @example Delete analytics bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .analytics
  *   .deleteBucket('analytics-data')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully deleted"
  *   },
  *   "error": null
  * }
  * ```
  */
  async deleteBucket(bucketName) {
    var _this3 = this;
    return _this3.handleOperation(async () => {
      return await remove(_this3.fetch, `${_this3.url}/bucket/${bucketName}`, {}, { headers: _this3.headers });
    });
  }
  /**
  * @alpha
  *
  * Get an Iceberg REST Catalog client configured for a specific analytics bucket
  * Use this to perform advanced table and namespace operations within the bucket
  * The returned client provides full access to the Apache Iceberg REST Catalog API
  * with the Supabase `{ data, error }` pattern for consistent error handling on all operations.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param bucketName - The name of the analytics bucket (warehouse) to connect to
  * @returns The wrapped Iceberg catalog client
  * @throws {StorageError} If the bucket name is invalid
  *
  * @example Get catalog and create table
  * ```js
  * // First, create an analytics bucket
  * const { data: bucket, error: bucketError } = await supabase
  *   .storage
  *   .analytics
  *   .createBucket('analytics-data')
  *
  * // Get the Iceberg catalog for that bucket
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // Create a namespace
  * const { error: nsError } = await catalog.createNamespace({ namespace: ['default'] })
  *
  * // Create a table with schema
  * const { data: tableMetadata, error: tableError } = await catalog.createTable(
  *   { namespace: ['default'] },
  *   {
  *     name: 'events',
  *     schema: {
  *       type: 'struct',
  *       fields: [
  *         { id: 1, name: 'id', type: 'long', required: true },
  *         { id: 2, name: 'timestamp', type: 'timestamp', required: true },
  *         { id: 3, name: 'user_id', type: 'string', required: false }
  *       ],
  *       'schema-id': 0,
  *       'identifier-field-ids': [1]
  *     },
  *     'partition-spec': {
  *       'spec-id': 0,
  *       fields: []
  *     },
  *     'write-order': {
  *       'order-id': 0,
  *       fields: []
  *     },
  *     properties: {
  *       'write.format.default': 'parquet'
  *     }
  *   }
  * )
  * ```
  *
  * @example List tables in namespace
  * ```js
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // List all tables in the default namespace
  * const { data: tables, error: listError } = await catalog.listTables({ namespace: ['default'] })
  * if (listError) {
  *   if (listError.isNotFound()) {
  *     console.log('Namespace not found')
  *   }
  *   return
  * }
  * console.log(tables) // [{ namespace: ['default'], name: 'events' }]
  * ```
  *
  * @example Working with namespaces
  * ```js
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // List all namespaces
  * const { data: namespaces } = await catalog.listNamespaces()
  *
  * // Create namespace with properties
  * await catalog.createNamespace(
  *   { namespace: ['production'] },
  *   { properties: { owner: 'data-team', env: 'prod' } }
  * )
  * ```
  *
  * @example Cleanup operations
  * ```js
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // Drop table with purge option (removes all data)
  * const { error: dropError } = await catalog.dropTable(
  *   { namespace: ['default'], name: 'events' },
  *   { purge: true }
  * )
  *
  * if (dropError?.isNotFound()) {
  *   console.log('Table does not exist')
  * }
  *
  * // Drop namespace (must be empty)
  * await catalog.dropNamespace({ namespace: ['default'] })
  * ```
  *
  * @remarks
  * This method provides a bridge between Supabase's bucket management and the standard
  * Apache Iceberg REST Catalog API. The bucket name maps to the Iceberg warehouse parameter.
  * All authentication and configuration is handled automatically using your Supabase credentials.
  *
  * **Error Handling**: Invalid bucket names throw immediately. All catalog
  * operations return `{ data, error }` where errors are `IcebergError` instances from iceberg-js.
  * Use helper methods like `error.isNotFound()` or check `error.status` for specific error handling.
  * Use `.throwOnError()` on the analytics client if you prefer exceptions for catalog operations.
  *
  * **Cleanup Operations**: When using `dropTable`, the `purge: true` option permanently
  * deletes all table data. Without it, the table is marked as deleted but data remains.
  *
  * **Library Dependency**: The returned catalog wraps `IcebergRestCatalog` from iceberg-js.
  * For complete API documentation and advanced usage, refer to the
  * [iceberg-js documentation](https://supabase.github.io/iceberg-js/).
  */
  from(bucketName) {
    var _this4 = this;
    if (!isValidBucketName(bucketName)) throw new StorageError("Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines and should avoid the use of any other characters.");
    const catalog = new IcebergRestCatalog({
      baseUrl: this.url,
      catalogName: bucketName,
      auth: {
        type: "custom",
        getHeaders: /* @__PURE__ */ __name(async () => _this4.headers, "getHeaders")
      },
      fetch: this.fetch
    });
    const shouldThrowOnError = this.shouldThrowOnError;
    return new Proxy(catalog, { get(target, prop) {
      const value = target[prop];
      if (typeof value !== "function") return value;
      return async (...args) => {
        try {
          return {
            data: await value.apply(target, args),
            error: null
          };
        } catch (error) {
          if (shouldThrowOnError) throw error;
          return {
            data: null,
            error
          };
        }
      };
    } });
  }
};
var VectorIndexApi = class extends BaseApiClient {
  static {
    __name(this, "VectorIndexApi");
  }
  /** Creates a new VectorIndexApi instance */
  constructor(url, headers = {}, fetch$1) {
    const finalUrl = url.replace(/\/$/, "");
    const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), {}, { "Content-Type": "application/json" }, headers);
    super(finalUrl, finalHeaders, fetch$1, "vectors");
  }
  /** Creates a new vector index within a bucket */
  async createIndex(options) {
    var _this = this;
    return _this.handleOperation(async () => {
      return await vectorsApi.post(_this.fetch, `${_this.url}/CreateIndex`, options, { headers: _this.headers }) || {};
    });
  }
  /** Retrieves metadata for a specific vector index */
  async getIndex(vectorBucketName, indexName) {
    var _this2 = this;
    return _this2.handleOperation(async () => {
      return await vectorsApi.post(_this2.fetch, `${_this2.url}/GetIndex`, {
        vectorBucketName,
        indexName
      }, { headers: _this2.headers });
    });
  }
  /** Lists vector indexes within a bucket with optional filtering and pagination */
  async listIndexes(options) {
    var _this3 = this;
    return _this3.handleOperation(async () => {
      return await vectorsApi.post(_this3.fetch, `${_this3.url}/ListIndexes`, options, { headers: _this3.headers });
    });
  }
  /** Deletes a vector index and all its data */
  async deleteIndex(vectorBucketName, indexName) {
    var _this4 = this;
    return _this4.handleOperation(async () => {
      return await vectorsApi.post(_this4.fetch, `${_this4.url}/DeleteIndex`, {
        vectorBucketName,
        indexName
      }, { headers: _this4.headers }) || {};
    });
  }
};
var VectorDataApi = class extends BaseApiClient {
  static {
    __name(this, "VectorDataApi");
  }
  /** Creates a new VectorDataApi instance */
  constructor(url, headers = {}, fetch$1) {
    const finalUrl = url.replace(/\/$/, "");
    const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), {}, { "Content-Type": "application/json" }, headers);
    super(finalUrl, finalHeaders, fetch$1, "vectors");
  }
  /** Inserts or updates vectors in batch (1-500 per request) */
  async putVectors(options) {
    var _this = this;
    if (options.vectors.length < 1 || options.vectors.length > 500) throw new Error("Vector batch size must be between 1 and 500 items");
    return _this.handleOperation(async () => {
      return await vectorsApi.post(_this.fetch, `${_this.url}/PutVectors`, options, { headers: _this.headers }) || {};
    });
  }
  /** Retrieves vectors by their keys in batch */
  async getVectors(options) {
    var _this2 = this;
    return _this2.handleOperation(async () => {
      return await vectorsApi.post(_this2.fetch, `${_this2.url}/GetVectors`, options, { headers: _this2.headers });
    });
  }
  /** Lists vectors in an index with pagination */
  async listVectors(options) {
    var _this3 = this;
    if (options.segmentCount !== void 0) {
      if (options.segmentCount < 1 || options.segmentCount > 16) throw new Error("segmentCount must be between 1 and 16");
      if (options.segmentIndex !== void 0) {
        if (options.segmentIndex < 0 || options.segmentIndex >= options.segmentCount) throw new Error(`segmentIndex must be between 0 and ${options.segmentCount - 1}`);
      }
    }
    return _this3.handleOperation(async () => {
      return await vectorsApi.post(_this3.fetch, `${_this3.url}/ListVectors`, options, { headers: _this3.headers });
    });
  }
  /** Queries for similar vectors using approximate nearest neighbor search */
  async queryVectors(options) {
    var _this4 = this;
    return _this4.handleOperation(async () => {
      return await vectorsApi.post(_this4.fetch, `${_this4.url}/QueryVectors`, options, { headers: _this4.headers });
    });
  }
  /** Deletes vectors by their keys in batch (1-500 per request) */
  async deleteVectors(options) {
    var _this5 = this;
    if (options.keys.length < 1 || options.keys.length > 500) throw new Error("Keys batch size must be between 1 and 500 items");
    return _this5.handleOperation(async () => {
      return await vectorsApi.post(_this5.fetch, `${_this5.url}/DeleteVectors`, options, { headers: _this5.headers }) || {};
    });
  }
};
var VectorBucketApi = class extends BaseApiClient {
  static {
    __name(this, "VectorBucketApi");
  }
  /** Creates a new VectorBucketApi instance */
  constructor(url, headers = {}, fetch$1) {
    const finalUrl = url.replace(/\/$/, "");
    const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), {}, { "Content-Type": "application/json" }, headers);
    super(finalUrl, finalHeaders, fetch$1, "vectors");
  }
  /** Creates a new vector bucket */
  async createBucket(vectorBucketName) {
    var _this = this;
    return _this.handleOperation(async () => {
      return await vectorsApi.post(_this.fetch, `${_this.url}/CreateVectorBucket`, { vectorBucketName }, { headers: _this.headers }) || {};
    });
  }
  /** Retrieves metadata for a specific vector bucket */
  async getBucket(vectorBucketName) {
    var _this2 = this;
    return _this2.handleOperation(async () => {
      return await vectorsApi.post(_this2.fetch, `${_this2.url}/GetVectorBucket`, { vectorBucketName }, { headers: _this2.headers });
    });
  }
  /** Lists vector buckets with optional filtering and pagination */
  async listBuckets(options = {}) {
    var _this3 = this;
    return _this3.handleOperation(async () => {
      return await vectorsApi.post(_this3.fetch, `${_this3.url}/ListVectorBuckets`, options, { headers: _this3.headers });
    });
  }
  /** Deletes a vector bucket (must be empty first) */
  async deleteBucket(vectorBucketName) {
    var _this4 = this;
    return _this4.handleOperation(async () => {
      return await vectorsApi.post(_this4.fetch, `${_this4.url}/DeleteVectorBucket`, { vectorBucketName }, { headers: _this4.headers }) || {};
    });
  }
};
var StorageVectorsClient = class extends VectorBucketApi {
  static {
    __name(this, "StorageVectorsClient");
  }
  /**
  * @alpha
  *
  * Creates a StorageVectorsClient that can manage buckets, indexes, and vectors.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param url - Base URL of the Storage Vectors REST API.
  * @param options.headers - Optional headers (for example `Authorization`) applied to every request.
  * @param options.fetch - Optional custom `fetch` implementation for non-browser runtimes.
  *
  * @example
  * ```typescript
  * const client = new StorageVectorsClient(url, options)
  * ```
  */
  constructor(url, options = {}) {
    super(url, options.headers || {}, options.fetch);
  }
  /**
  *
  * @alpha
  *
  * Access operations for a specific vector bucket
  * Returns a scoped client for index and vector operations within the bucket
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param vectorBucketName - Name of the vector bucket
  * @returns Bucket-scoped client with index and vector operations
  *
  * @example
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * ```
  */
  from(vectorBucketName) {
    return new VectorBucketScope(this.url, this.headers, vectorBucketName, this.fetch);
  }
  /**
  *
  * @alpha
  *
  * Creates a new vector bucket
  * Vector buckets are containers for vector indexes and their data
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param vectorBucketName - Unique name for the vector bucket
  * @returns Promise with empty response on success or error
  *
  * @example
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .createBucket('embeddings-prod')
  * ```
  */
  async createBucket(vectorBucketName) {
    var _superprop_getCreateBucket = /* @__PURE__ */ __name(() => super.createBucket, "_superprop_getCreateBucket"), _this = this;
    return _superprop_getCreateBucket().call(_this, vectorBucketName);
  }
  /**
  *
  * @alpha
  *
  * Retrieves metadata for a specific vector bucket
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param vectorBucketName - Name of the vector bucket
  * @returns Promise with bucket metadata or error
  *
  * @example
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .getBucket('embeddings-prod')
  *
  * console.log('Bucket created:', data?.vectorBucket.creationTime)
  * ```
  */
  async getBucket(vectorBucketName) {
    var _superprop_getGetBucket = /* @__PURE__ */ __name(() => super.getBucket, "_superprop_getGetBucket"), _this2 = this;
    return _superprop_getGetBucket().call(_this2, vectorBucketName);
  }
  /**
  *
  * @alpha
  *
  * Lists all vector buckets with optional filtering and pagination
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Optional filters (prefix, maxResults, nextToken)
  * @returns Promise with list of buckets or error
  *
  * @example
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .listBuckets({ prefix: 'embeddings-' })
  *
  * data?.vectorBuckets.forEach(bucket => {
  *   console.log(bucket.vectorBucketName)
  * })
  * ```
  */
  async listBuckets(options = {}) {
    var _superprop_getListBuckets = /* @__PURE__ */ __name(() => super.listBuckets, "_superprop_getListBuckets"), _this3 = this;
    return _superprop_getListBuckets().call(_this3, options);
  }
  /**
  *
  * @alpha
  *
  * Deletes a vector bucket (bucket must be empty)
  * All indexes must be deleted before deleting the bucket
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param vectorBucketName - Name of the vector bucket to delete
  * @returns Promise with empty response on success or error
  *
  * @example
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .deleteBucket('embeddings-old')
  * ```
  */
  async deleteBucket(vectorBucketName) {
    var _superprop_getDeleteBucket = /* @__PURE__ */ __name(() => super.deleteBucket, "_superprop_getDeleteBucket"), _this4 = this;
    return _superprop_getDeleteBucket().call(_this4, vectorBucketName);
  }
};
var VectorBucketScope = class extends VectorIndexApi {
  static {
    __name(this, "VectorBucketScope");
  }
  /**
  * @alpha
  *
  * Creates a helper that automatically scopes all index operations to the provided bucket.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @example
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * ```
  */
  constructor(url, headers, vectorBucketName, fetch$1) {
    super(url, headers, fetch$1);
    this.vectorBucketName = vectorBucketName;
  }
  /**
  *
  * @alpha
  *
  * Creates a new vector index in this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Index configuration (vectorBucketName is automatically set)
  * @returns Promise with empty response on success or error
  *
  * @example
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * await bucket.createIndex({
  *   indexName: 'documents-openai',
  *   dataType: 'float32',
  *   dimension: 1536,
  *   distanceMetric: 'cosine',
  *   metadataConfiguration: {
  *     nonFilterableMetadataKeys: ['raw_text']
  *   }
  * })
  * ```
  */
  async createIndex(options) {
    var _superprop_getCreateIndex = /* @__PURE__ */ __name(() => super.createIndex, "_superprop_getCreateIndex"), _this5 = this;
    return _superprop_getCreateIndex().call(_this5, _objectSpread22(_objectSpread22({}, options), {}, { vectorBucketName: _this5.vectorBucketName }));
  }
  /**
  *
  * @alpha
  *
  * Lists indexes in this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Listing options (vectorBucketName is automatically set)
  * @returns Promise with response containing indexes array and pagination token or error
  *
  * @example
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * const { data } = await bucket.listIndexes({ prefix: 'documents-' })
  * ```
  */
  async listIndexes(options = {}) {
    var _superprop_getListIndexes = /* @__PURE__ */ __name(() => super.listIndexes, "_superprop_getListIndexes"), _this6 = this;
    return _superprop_getListIndexes().call(_this6, _objectSpread22(_objectSpread22({}, options), {}, { vectorBucketName: _this6.vectorBucketName }));
  }
  /**
  *
  * @alpha
  *
  * Retrieves metadata for a specific index in this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param indexName - Name of the index to retrieve
  * @returns Promise with index metadata or error
  *
  * @example
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * const { data } = await bucket.getIndex('documents-openai')
  * console.log('Dimension:', data?.index.dimension)
  * ```
  */
  async getIndex(indexName) {
    var _superprop_getGetIndex = /* @__PURE__ */ __name(() => super.getIndex, "_superprop_getGetIndex"), _this7 = this;
    return _superprop_getGetIndex().call(_this7, _this7.vectorBucketName, indexName);
  }
  /**
  *
  * @alpha
  *
  * Deletes an index from this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param indexName - Name of the index to delete
  * @returns Promise with empty response on success or error
  *
  * @example
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * await bucket.deleteIndex('old-index')
  * ```
  */
  async deleteIndex(indexName) {
    var _superprop_getDeleteIndex = /* @__PURE__ */ __name(() => super.deleteIndex, "_superprop_getDeleteIndex"), _this8 = this;
    return _superprop_getDeleteIndex().call(_this8, _this8.vectorBucketName, indexName);
  }
  /**
  *
  * @alpha
  *
  * Access operations for a specific index within this bucket
  * Returns a scoped client for vector data operations
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param indexName - Name of the index
  * @returns Index-scoped client with vector data operations
  *
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  *
  * // Insert vectors
  * await index.putVectors({
  *   vectors: [
  *     { key: 'doc-1', data: { float32: [...] }, metadata: { title: 'Intro' } }
  *   ]
  * })
  *
  * // Query similar vectors
  * const { data } = await index.queryVectors({
  *   queryVector: { float32: [...] },
  *   topK: 5
  * })
  * ```
  */
  index(indexName) {
    return new VectorIndexScope(this.url, this.headers, this.vectorBucketName, indexName, this.fetch);
  }
};
var VectorIndexScope = class extends VectorDataApi {
  static {
    __name(this, "VectorIndexScope");
  }
  /**
  *
  * @alpha
  *
  * Creates a helper that automatically scopes all vector operations to the provided bucket/index names.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * ```
  */
  constructor(url, headers, vectorBucketName, indexName, fetch$1) {
    super(url, headers, fetch$1);
    this.vectorBucketName = vectorBucketName;
    this.indexName = indexName;
  }
  /**
  *
  * @alpha
  *
  * Inserts or updates vectors in this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Vector insertion options (bucket and index names automatically set)
  * @returns Promise with empty response on success or error
  *
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * await index.putVectors({
  *   vectors: [
  *     {
  *       key: 'doc-1',
  *       data: { float32: [0.1, 0.2, ...] },
  *       metadata: { title: 'Introduction', page: 1 }
  *     }
  *   ]
  * })
  * ```
  */
  async putVectors(options) {
    var _superprop_getPutVectors = /* @__PURE__ */ __name(() => super.putVectors, "_superprop_getPutVectors"), _this9 = this;
    return _superprop_getPutVectors().call(_this9, _objectSpread22(_objectSpread22({}, options), {}, {
      vectorBucketName: _this9.vectorBucketName,
      indexName: _this9.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Retrieves vectors by keys from this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Vector retrieval options (bucket and index names automatically set)
  * @returns Promise with response containing vectors array or error
  *
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * const { data } = await index.getVectors({
  *   keys: ['doc-1', 'doc-2'],
  *   returnMetadata: true
  * })
  * ```
  */
  async getVectors(options) {
    var _superprop_getGetVectors = /* @__PURE__ */ __name(() => super.getVectors, "_superprop_getGetVectors"), _this10 = this;
    return _superprop_getGetVectors().call(_this10, _objectSpread22(_objectSpread22({}, options), {}, {
      vectorBucketName: _this10.vectorBucketName,
      indexName: _this10.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Lists vectors in this index with pagination
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Listing options (bucket and index names automatically set)
  * @returns Promise with response containing vectors array and pagination token or error
  *
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * const { data } = await index.listVectors({
  *   maxResults: 500,
  *   returnMetadata: true
  * })
  * ```
  */
  async listVectors(options = {}) {
    var _superprop_getListVectors = /* @__PURE__ */ __name(() => super.listVectors, "_superprop_getListVectors"), _this11 = this;
    return _superprop_getListVectors().call(_this11, _objectSpread22(_objectSpread22({}, options), {}, {
      vectorBucketName: _this11.vectorBucketName,
      indexName: _this11.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Queries for similar vectors in this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Query options (bucket and index names automatically set)
  * @returns Promise with response containing matches array of similar vectors ordered by distance or error
  *
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * const { data } = await index.queryVectors({
  *   queryVector: { float32: [0.1, 0.2, ...] },
  *   topK: 5,
  *   filter: { category: 'technical' },
  *   returnDistance: true,
  *   returnMetadata: true
  * })
  * ```
  */
  async queryVectors(options) {
    var _superprop_getQueryVectors = /* @__PURE__ */ __name(() => super.queryVectors, "_superprop_getQueryVectors"), _this12 = this;
    return _superprop_getQueryVectors().call(_this12, _objectSpread22(_objectSpread22({}, options), {}, {
      vectorBucketName: _this12.vectorBucketName,
      indexName: _this12.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Deletes vectors by keys from this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Deletion options (bucket and index names automatically set)
  * @returns Promise with empty response on success or error
  *
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * await index.deleteVectors({
  *   keys: ['doc-1', 'doc-2', 'doc-3']
  * })
  * ```
  */
  async deleteVectors(options) {
    var _superprop_getDeleteVectors = /* @__PURE__ */ __name(() => super.deleteVectors, "_superprop_getDeleteVectors"), _this13 = this;
    return _superprop_getDeleteVectors().call(_this13, _objectSpread22(_objectSpread22({}, options), {}, {
      vectorBucketName: _this13.vectorBucketName,
      indexName: _this13.indexName
    }));
  }
};
var StorageClient = class extends StorageBucketApi {
  static {
    __name(this, "StorageClient");
  }
  /**
  * Creates a client for Storage buckets, files, analytics, and vectors.
  *
  * @category File Buckets
  * @example
  * ```ts
  * import { StorageClient } from '@supabase/storage-js'
  *
  * const storage = new StorageClient('https://xyzcompany.supabase.co/storage/v1', {
  *   apikey: 'public-anon-key',
  * })
  * const avatars = storage.from('avatars')
  * ```
  */
  constructor(url, headers = {}, fetch$1, opts) {
    super(url, headers, fetch$1, opts);
  }
  /**
  * Perform file operation in a bucket.
  *
  * @category File Buckets
  * @param id The bucket id to operate on.
  *
  * @example
  * ```typescript
  * const avatars = supabase.storage.from('avatars')
  * ```
  */
  from(id) {
    return new StorageFileApi(this.url, this.headers, id, this.fetch);
  }
  /**
  *
  * @alpha
  *
  * Access vector storage operations.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @returns A StorageVectorsClient instance configured with the current storage settings.
  */
  get vectors() {
    return new StorageVectorsClient(this.url + "/vector", {
      headers: this.headers,
      fetch: this.fetch
    });
  }
  /**
  *
  * @alpha
  *
  * Access analytics storage operations using Iceberg tables.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @returns A StorageAnalyticsClient instance configured with the current storage settings.
  */
  get analytics() {
    return new StorageAnalyticsClient(this.url + "/iceberg", this.headers, this.fetch);
  }
};

// node_modules/@supabase/auth-js/dist/module/lib/version.js
var version3 = "2.97.0";

// node_modules/@supabase/auth-js/dist/module/lib/constants.js
var AUTO_REFRESH_TICK_DURATION_MS = 30 * 1e3;
var AUTO_REFRESH_TICK_THRESHOLD = 3;
var EXPIRY_MARGIN_MS = AUTO_REFRESH_TICK_THRESHOLD * AUTO_REFRESH_TICK_DURATION_MS;
var GOTRUE_URL = "http://localhost:9999";
var STORAGE_KEY = "supabase.auth.token";
var DEFAULT_HEADERS2 = { "X-Client-Info": `gotrue-js/${version3}` };
var API_VERSION_HEADER_NAME = "X-Supabase-Api-Version";
var API_VERSIONS = {
  "2024-01-01": {
    timestamp: Date.parse("2024-01-01T00:00:00.0Z"),
    name: "2024-01-01"
  }
};
var BASE64URL_REGEX = /^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i;
var JWKS_TTL = 10 * 60 * 1e3;

// node_modules/@supabase/auth-js/dist/module/lib/errors.js
var AuthError = class extends Error {
  static {
    __name(this, "AuthError");
  }
  constructor(message2, status, code) {
    super(message2);
    this.__isAuthError = true;
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
};
function isAuthError(error) {
  return typeof error === "object" && error !== null && "__isAuthError" in error;
}
__name(isAuthError, "isAuthError");
var AuthApiError = class extends AuthError {
  static {
    __name(this, "AuthApiError");
  }
  constructor(message2, status, code) {
    super(message2, status, code);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
  }
};
function isAuthApiError(error) {
  return isAuthError(error) && error.name === "AuthApiError";
}
__name(isAuthApiError, "isAuthApiError");
var AuthUnknownError = class extends AuthError {
  static {
    __name(this, "AuthUnknownError");
  }
  constructor(message2, originalError) {
    super(message2);
    this.name = "AuthUnknownError";
    this.originalError = originalError;
  }
};
var CustomAuthError = class extends AuthError {
  static {
    __name(this, "CustomAuthError");
  }
  constructor(message2, name, status, code) {
    super(message2, status, code);
    this.name = name;
    this.status = status;
  }
};
var AuthSessionMissingError = class extends CustomAuthError {
  static {
    __name(this, "AuthSessionMissingError");
  }
  constructor() {
    super("Auth session missing!", "AuthSessionMissingError", 400, void 0);
  }
};
function isAuthSessionMissingError(error) {
  return isAuthError(error) && error.name === "AuthSessionMissingError";
}
__name(isAuthSessionMissingError, "isAuthSessionMissingError");
var AuthInvalidTokenResponseError = class extends CustomAuthError {
  static {
    __name(this, "AuthInvalidTokenResponseError");
  }
  constructor() {
    super("Auth session or user missing", "AuthInvalidTokenResponseError", 500, void 0);
  }
};
var AuthInvalidCredentialsError = class extends CustomAuthError {
  static {
    __name(this, "AuthInvalidCredentialsError");
  }
  constructor(message2) {
    super(message2, "AuthInvalidCredentialsError", 400, void 0);
  }
};
var AuthImplicitGrantRedirectError = class extends CustomAuthError {
  static {
    __name(this, "AuthImplicitGrantRedirectError");
  }
  constructor(message2, details = null) {
    super(message2, "AuthImplicitGrantRedirectError", 500, void 0);
    this.details = null;
    this.details = details;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      details: this.details
    };
  }
};
function isAuthImplicitGrantRedirectError(error) {
  return isAuthError(error) && error.name === "AuthImplicitGrantRedirectError";
}
__name(isAuthImplicitGrantRedirectError, "isAuthImplicitGrantRedirectError");
var AuthPKCEGrantCodeExchangeError = class extends CustomAuthError {
  static {
    __name(this, "AuthPKCEGrantCodeExchangeError");
  }
  constructor(message2, details = null) {
    super(message2, "AuthPKCEGrantCodeExchangeError", 500, void 0);
    this.details = null;
    this.details = details;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      details: this.details
    };
  }
};
var AuthPKCECodeVerifierMissingError = class extends CustomAuthError {
  static {
    __name(this, "AuthPKCECodeVerifierMissingError");
  }
  constructor() {
    super("PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.", "AuthPKCECodeVerifierMissingError", 400, "pkce_code_verifier_not_found");
  }
};
var AuthRetryableFetchError = class extends CustomAuthError {
  static {
    __name(this, "AuthRetryableFetchError");
  }
  constructor(message2, status) {
    super(message2, "AuthRetryableFetchError", status, void 0);
  }
};
function isAuthRetryableFetchError(error) {
  return isAuthError(error) && error.name === "AuthRetryableFetchError";
}
__name(isAuthRetryableFetchError, "isAuthRetryableFetchError");
var AuthWeakPasswordError = class extends CustomAuthError {
  static {
    __name(this, "AuthWeakPasswordError");
  }
  constructor(message2, status, reasons) {
    super(message2, "AuthWeakPasswordError", status, "weak_password");
    this.reasons = reasons;
  }
};
var AuthInvalidJwtError = class extends CustomAuthError {
  static {
    __name(this, "AuthInvalidJwtError");
  }
  constructor(message2) {
    super(message2, "AuthInvalidJwtError", 400, "invalid_jwt");
  }
};

// node_modules/@supabase/auth-js/dist/module/lib/base64url.js
var TO_BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("");
var IGNORE_BASE64URL = " 	\n\r=".split("");
var FROM_BASE64URL = (() => {
  const charMap = new Array(128);
  for (let i = 0; i < charMap.length; i += 1) {
    charMap[i] = -1;
  }
  for (let i = 0; i < IGNORE_BASE64URL.length; i += 1) {
    charMap[IGNORE_BASE64URL[i].charCodeAt(0)] = -2;
  }
  for (let i = 0; i < TO_BASE64URL.length; i += 1) {
    charMap[TO_BASE64URL[i].charCodeAt(0)] = i;
  }
  return charMap;
})();
function byteToBase64URL(byte, state, emit) {
  if (byte !== null) {
    state.queue = state.queue << 8 | byte;
    state.queuedBits += 8;
    while (state.queuedBits >= 6) {
      const pos = state.queue >> state.queuedBits - 6 & 63;
      emit(TO_BASE64URL[pos]);
      state.queuedBits -= 6;
    }
  } else if (state.queuedBits > 0) {
    state.queue = state.queue << 6 - state.queuedBits;
    state.queuedBits = 6;
    while (state.queuedBits >= 6) {
      const pos = state.queue >> state.queuedBits - 6 & 63;
      emit(TO_BASE64URL[pos]);
      state.queuedBits -= 6;
    }
  }
}
__name(byteToBase64URL, "byteToBase64URL");
function byteFromBase64URL(charCode, state, emit) {
  const bits = FROM_BASE64URL[charCode];
  if (bits > -1) {
    state.queue = state.queue << 6 | bits;
    state.queuedBits += 6;
    while (state.queuedBits >= 8) {
      emit(state.queue >> state.queuedBits - 8 & 255);
      state.queuedBits -= 8;
    }
  } else if (bits === -2) {
    return;
  } else {
    throw new Error(`Invalid Base64-URL character "${String.fromCharCode(charCode)}"`);
  }
}
__name(byteFromBase64URL, "byteFromBase64URL");
function stringFromBase64URL(str) {
  const conv = [];
  const utf8Emit = /* @__PURE__ */ __name((codepoint) => {
    conv.push(String.fromCodePoint(codepoint));
  }, "utf8Emit");
  const utf8State = {
    utf8seq: 0,
    codepoint: 0
  };
  const b64State = { queue: 0, queuedBits: 0 };
  const byteEmit = /* @__PURE__ */ __name((byte) => {
    stringFromUTF8(byte, utf8State, utf8Emit);
  }, "byteEmit");
  for (let i = 0; i < str.length; i += 1) {
    byteFromBase64URL(str.charCodeAt(i), b64State, byteEmit);
  }
  return conv.join("");
}
__name(stringFromBase64URL, "stringFromBase64URL");
function codepointToUTF8(codepoint, emit) {
  if (codepoint <= 127) {
    emit(codepoint);
    return;
  } else if (codepoint <= 2047) {
    emit(192 | codepoint >> 6);
    emit(128 | codepoint & 63);
    return;
  } else if (codepoint <= 65535) {
    emit(224 | codepoint >> 12);
    emit(128 | codepoint >> 6 & 63);
    emit(128 | codepoint & 63);
    return;
  } else if (codepoint <= 1114111) {
    emit(240 | codepoint >> 18);
    emit(128 | codepoint >> 12 & 63);
    emit(128 | codepoint >> 6 & 63);
    emit(128 | codepoint & 63);
    return;
  }
  throw new Error(`Unrecognized Unicode codepoint: ${codepoint.toString(16)}`);
}
__name(codepointToUTF8, "codepointToUTF8");
function stringToUTF8(str, emit) {
  for (let i = 0; i < str.length; i += 1) {
    let codepoint = str.charCodeAt(i);
    if (codepoint > 55295 && codepoint <= 56319) {
      const highSurrogate = (codepoint - 55296) * 1024 & 65535;
      const lowSurrogate = str.charCodeAt(i + 1) - 56320 & 65535;
      codepoint = (lowSurrogate | highSurrogate) + 65536;
      i += 1;
    }
    codepointToUTF8(codepoint, emit);
  }
}
__name(stringToUTF8, "stringToUTF8");
function stringFromUTF8(byte, state, emit) {
  if (state.utf8seq === 0) {
    if (byte <= 127) {
      emit(byte);
      return;
    }
    for (let leadingBit = 1; leadingBit < 6; leadingBit += 1) {
      if ((byte >> 7 - leadingBit & 1) === 0) {
        state.utf8seq = leadingBit;
        break;
      }
    }
    if (state.utf8seq === 2) {
      state.codepoint = byte & 31;
    } else if (state.utf8seq === 3) {
      state.codepoint = byte & 15;
    } else if (state.utf8seq === 4) {
      state.codepoint = byte & 7;
    } else {
      throw new Error("Invalid UTF-8 sequence");
    }
    state.utf8seq -= 1;
  } else if (state.utf8seq > 0) {
    if (byte <= 127) {
      throw new Error("Invalid UTF-8 sequence");
    }
    state.codepoint = state.codepoint << 6 | byte & 63;
    state.utf8seq -= 1;
    if (state.utf8seq === 0) {
      emit(state.codepoint);
    }
  }
}
__name(stringFromUTF8, "stringFromUTF8");
function base64UrlToUint8Array(str) {
  const result = [];
  const state = { queue: 0, queuedBits: 0 };
  const onByte = /* @__PURE__ */ __name((byte) => {
    result.push(byte);
  }, "onByte");
  for (let i = 0; i < str.length; i += 1) {
    byteFromBase64URL(str.charCodeAt(i), state, onByte);
  }
  return new Uint8Array(result);
}
__name(base64UrlToUint8Array, "base64UrlToUint8Array");
function stringToUint8Array(str) {
  const result = [];
  stringToUTF8(str, (byte) => result.push(byte));
  return new Uint8Array(result);
}
__name(stringToUint8Array, "stringToUint8Array");
function bytesToBase64URL(bytes) {
  const result = [];
  const state = { queue: 0, queuedBits: 0 };
  const onChar = /* @__PURE__ */ __name((char) => {
    result.push(char);
  }, "onChar");
  bytes.forEach((byte) => byteToBase64URL(byte, state, onChar));
  byteToBase64URL(null, state, onChar);
  return result.join("");
}
__name(bytesToBase64URL, "bytesToBase64URL");

// node_modules/@supabase/auth-js/dist/module/lib/helpers.js
function expiresAt(expiresIn) {
  const timeNow = Math.round(Date.now() / 1e3);
  return timeNow + expiresIn;
}
__name(expiresAt, "expiresAt");
function generateCallbackId() {
  return Symbol("auth-callback");
}
__name(generateCallbackId, "generateCallbackId");
var isBrowser = /* @__PURE__ */ __name(() => typeof window !== "undefined" && typeof document !== "undefined", "isBrowser");
var localStorageWriteTests = {
  tested: false,
  writable: false
};
var supportsLocalStorage = /* @__PURE__ */ __name(() => {
  if (!isBrowser()) {
    return false;
  }
  try {
    if (typeof globalThis.localStorage !== "object") {
      return false;
    }
  } catch (e) {
    return false;
  }
  if (localStorageWriteTests.tested) {
    return localStorageWriteTests.writable;
  }
  const randomKey = `lswt-${Math.random()}${Math.random()}`;
  try {
    globalThis.localStorage.setItem(randomKey, randomKey);
    globalThis.localStorage.removeItem(randomKey);
    localStorageWriteTests.tested = true;
    localStorageWriteTests.writable = true;
  } catch (e) {
    localStorageWriteTests.tested = true;
    localStorageWriteTests.writable = false;
  }
  return localStorageWriteTests.writable;
}, "supportsLocalStorage");
function parseParametersFromURL(href) {
  const result = {};
  const url = new URL(href);
  if (url.hash && url.hash[0] === "#") {
    try {
      const hashSearchParams = new URLSearchParams(url.hash.substring(1));
      hashSearchParams.forEach((value, key) => {
        result[key] = value;
      });
    } catch (e) {
    }
  }
  url.searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}
__name(parseParametersFromURL, "parseParametersFromURL");
var resolveFetch3 = /* @__PURE__ */ __name((customFetch) => {
  if (customFetch) {
    return (...args) => customFetch(...args);
  }
  return (...args) => fetch(...args);
}, "resolveFetch");
var looksLikeFetchResponse = /* @__PURE__ */ __name((maybeResponse) => {
  return typeof maybeResponse === "object" && maybeResponse !== null && "status" in maybeResponse && "ok" in maybeResponse && "json" in maybeResponse && typeof maybeResponse.json === "function";
}, "looksLikeFetchResponse");
var setItemAsync = /* @__PURE__ */ __name(async (storage, key, data) => {
  await storage.setItem(key, JSON.stringify(data));
}, "setItemAsync");
var getItemAsync = /* @__PURE__ */ __name(async (storage, key) => {
  const value = await storage.getItem(key);
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (_a) {
    return value;
  }
}, "getItemAsync");
var removeItemAsync = /* @__PURE__ */ __name(async (storage, key) => {
  await storage.removeItem(key);
}, "removeItemAsync");
var Deferred = class _Deferred {
  static {
    __name(this, "Deferred");
  }
  constructor() {
    ;
    this.promise = new _Deferred.promiseConstructor((res, rej) => {
      ;
      this.resolve = res;
      this.reject = rej;
    });
  }
};
Deferred.promiseConstructor = Promise;
function decodeJWT(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AuthInvalidJwtError("Invalid JWT structure");
  }
  for (let i = 0; i < parts.length; i++) {
    if (!BASE64URL_REGEX.test(parts[i])) {
      throw new AuthInvalidJwtError("JWT not in base64url format");
    }
  }
  const data = {
    // using base64url lib
    header: JSON.parse(stringFromBase64URL(parts[0])),
    payload: JSON.parse(stringFromBase64URL(parts[1])),
    signature: base64UrlToUint8Array(parts[2]),
    raw: {
      header: parts[0],
      payload: parts[1]
    }
  };
  return data;
}
__name(decodeJWT, "decodeJWT");
async function sleep(time) {
  return await new Promise((accept) => {
    setTimeout(() => accept(null), time);
  });
}
__name(sleep, "sleep");
function retryable(fn, isRetryable) {
  const promise = new Promise((accept, reject) => {
    ;
    (async () => {
      for (let attempt = 0; attempt < Infinity; attempt++) {
        try {
          const result = await fn(attempt);
          if (!isRetryable(attempt, null, result)) {
            accept(result);
            return;
          }
        } catch (e) {
          if (!isRetryable(attempt, e)) {
            reject(e);
            return;
          }
        }
      }
    })();
  });
  return promise;
}
__name(retryable, "retryable");
function dec2hex(dec) {
  return ("0" + dec.toString(16)).substr(-2);
}
__name(dec2hex, "dec2hex");
function generatePKCEVerifier() {
  const verifierLength = 56;
  const array = new Uint32Array(verifierLength);
  if (typeof crypto === "undefined") {
    const charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const charSetLen = charSet.length;
    let verifier = "";
    for (let i = 0; i < verifierLength; i++) {
      verifier += charSet.charAt(Math.floor(Math.random() * charSetLen));
    }
    return verifier;
  }
  crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join("");
}
__name(generatePKCEVerifier, "generatePKCEVerifier");
async function sha256(randomString) {
  const encoder2 = new TextEncoder();
  const encodedData = encoder2.encode(randomString);
  const hash = await crypto.subtle.digest("SHA-256", encodedData);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map((c) => String.fromCharCode(c)).join("");
}
__name(sha256, "sha256");
async function generatePKCEChallenge(verifier) {
  const hasCryptoSupport = typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined" && typeof TextEncoder !== "undefined";
  if (!hasCryptoSupport) {
    console.warn("WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256.");
    return verifier;
  }
  const hashed = await sha256(verifier);
  return btoa(hashed).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(generatePKCEChallenge, "generatePKCEChallenge");
async function getCodeChallengeAndMethod(storage, storageKey, isPasswordRecovery = false) {
  const codeVerifier = generatePKCEVerifier();
  let storedCodeVerifier = codeVerifier;
  if (isPasswordRecovery) {
    storedCodeVerifier += "/PASSWORD_RECOVERY";
  }
  await setItemAsync(storage, `${storageKey}-code-verifier`, storedCodeVerifier);
  const codeChallenge = await generatePKCEChallenge(codeVerifier);
  const codeChallengeMethod = codeVerifier === codeChallenge ? "plain" : "s256";
  return [codeChallenge, codeChallengeMethod];
}
__name(getCodeChallengeAndMethod, "getCodeChallengeAndMethod");
var API_VERSION_REGEX = /^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;
function parseResponseAPIVersion(response) {
  const apiVersion = response.headers.get(API_VERSION_HEADER_NAME);
  if (!apiVersion) {
    return null;
  }
  if (!apiVersion.match(API_VERSION_REGEX)) {
    return null;
  }
  try {
    const date = /* @__PURE__ */ new Date(`${apiVersion}T00:00:00.0Z`);
    return date;
  } catch (e) {
    return null;
  }
}
__name(parseResponseAPIVersion, "parseResponseAPIVersion");
function validateExp(exp) {
  if (!exp) {
    throw new Error("Missing exp claim");
  }
  const timeNow = Math.floor(Date.now() / 1e3);
  if (exp <= timeNow) {
    throw new Error("JWT has expired");
  }
}
__name(validateExp, "validateExp");
function getAlgorithm(alg) {
  switch (alg) {
    case "RS256":
      return {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" }
      };
    case "ES256":
      return {
        name: "ECDSA",
        namedCurve: "P-256",
        hash: { name: "SHA-256" }
      };
    default:
      throw new Error("Invalid alg claim");
  }
}
__name(getAlgorithm, "getAlgorithm");
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function validateUUID(str) {
  if (!UUID_REGEX.test(str)) {
    throw new Error("@supabase/auth-js: Expected parameter to be UUID but is not");
  }
}
__name(validateUUID, "validateUUID");
function userNotAvailableProxy() {
  const proxyTarget = {};
  return new Proxy(proxyTarget, {
    get: /* @__PURE__ */ __name((target, prop) => {
      if (prop === "__isUserNotAvailableProxy") {
        return true;
      }
      if (typeof prop === "symbol") {
        const sProp = prop.toString();
        if (sProp === "Symbol(Symbol.toPrimitive)" || sProp === "Symbol(Symbol.toStringTag)" || sProp === "Symbol(util.inspect.custom)") {
          return void 0;
        }
      }
      throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${prop}" property of the session object is not supported. Please use getUser() instead.`);
    }, "get"),
    set: /* @__PURE__ */ __name((_target, prop) => {
      throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${prop}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
    }, "set"),
    deleteProperty: /* @__PURE__ */ __name((_target, prop) => {
      throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${prop}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
    }, "deleteProperty")
  });
}
__name(userNotAvailableProxy, "userNotAvailableProxy");
function insecureUserWarningProxy(user, suppressWarningRef) {
  return new Proxy(user, {
    get: /* @__PURE__ */ __name((target, prop, receiver) => {
      if (prop === "__isInsecureUserWarningProxy") {
        return true;
      }
      if (typeof prop === "symbol") {
        const sProp = prop.toString();
        if (sProp === "Symbol(Symbol.toPrimitive)" || sProp === "Symbol(Symbol.toStringTag)" || sProp === "Symbol(util.inspect.custom)" || sProp === "Symbol(nodejs.util.inspect.custom)") {
          return Reflect.get(target, prop, receiver);
        }
      }
      if (!suppressWarningRef.value && typeof prop === "string") {
        console.warn("Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server.");
        suppressWarningRef.value = true;
      }
      return Reflect.get(target, prop, receiver);
    }, "get")
  });
}
__name(insecureUserWarningProxy, "insecureUserWarningProxy");
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
__name(deepClone, "deepClone");

// node_modules/@supabase/auth-js/dist/module/lib/fetch.js
var _getErrorMessage2 = /* @__PURE__ */ __name((err) => err.msg || err.message || err.error_description || err.error || JSON.stringify(err), "_getErrorMessage");
var NETWORK_ERROR_CODES = [502, 503, 504];
async function handleError2(error) {
  var _a;
  if (!looksLikeFetchResponse(error)) {
    throw new AuthRetryableFetchError(_getErrorMessage2(error), 0);
  }
  if (NETWORK_ERROR_CODES.includes(error.status)) {
    throw new AuthRetryableFetchError(_getErrorMessage2(error), error.status);
  }
  let data;
  try {
    data = await error.json();
  } catch (e) {
    throw new AuthUnknownError(_getErrorMessage2(e), e);
  }
  let errorCode = void 0;
  const responseAPIVersion = parseResponseAPIVersion(error);
  if (responseAPIVersion && responseAPIVersion.getTime() >= API_VERSIONS["2024-01-01"].timestamp && typeof data === "object" && data && typeof data.code === "string") {
    errorCode = data.code;
  } else if (typeof data === "object" && data && typeof data.error_code === "string") {
    errorCode = data.error_code;
  }
  if (!errorCode) {
    if (typeof data === "object" && data && typeof data.weak_password === "object" && data.weak_password && Array.isArray(data.weak_password.reasons) && data.weak_password.reasons.length && data.weak_password.reasons.reduce((a, i) => a && typeof i === "string", true)) {
      throw new AuthWeakPasswordError(_getErrorMessage2(data), error.status, data.weak_password.reasons);
    }
  } else if (errorCode === "weak_password") {
    throw new AuthWeakPasswordError(_getErrorMessage2(data), error.status, ((_a = data.weak_password) === null || _a === void 0 ? void 0 : _a.reasons) || []);
  } else if (errorCode === "session_not_found") {
    throw new AuthSessionMissingError();
  }
  throw new AuthApiError(_getErrorMessage2(data), error.status || 500, errorCode);
}
__name(handleError2, "handleError");
var _getRequestParams2 = /* @__PURE__ */ __name((method, options, parameters, body) => {
  const params = { method, headers: (options === null || options === void 0 ? void 0 : options.headers) || {} };
  if (method === "GET") {
    return params;
  }
  params.headers = Object.assign({ "Content-Type": "application/json;charset=UTF-8" }, options === null || options === void 0 ? void 0 : options.headers);
  params.body = JSON.stringify(body);
  return Object.assign(Object.assign({}, params), parameters);
}, "_getRequestParams");
async function _request(fetcher, method, url, options) {
  var _a;
  const headers = Object.assign({}, options === null || options === void 0 ? void 0 : options.headers);
  if (!headers[API_VERSION_HEADER_NAME]) {
    headers[API_VERSION_HEADER_NAME] = API_VERSIONS["2024-01-01"].name;
  }
  if (options === null || options === void 0 ? void 0 : options.jwt) {
    headers["Authorization"] = `Bearer ${options.jwt}`;
  }
  const qs = (_a = options === null || options === void 0 ? void 0 : options.query) !== null && _a !== void 0 ? _a : {};
  if (options === null || options === void 0 ? void 0 : options.redirectTo) {
    qs["redirect_to"] = options.redirectTo;
  }
  const queryString = Object.keys(qs).length ? "?" + new URLSearchParams(qs).toString() : "";
  const data = await _handleRequest2(fetcher, method, url + queryString, {
    headers,
    noResolveJson: options === null || options === void 0 ? void 0 : options.noResolveJson
  }, {}, options === null || options === void 0 ? void 0 : options.body);
  return (options === null || options === void 0 ? void 0 : options.xform) ? options === null || options === void 0 ? void 0 : options.xform(data) : { data: Object.assign({}, data), error: null };
}
__name(_request, "_request");
async function _handleRequest2(fetcher, method, url, options, parameters, body) {
  const requestParams = _getRequestParams2(method, options, parameters, body);
  let result;
  try {
    result = await fetcher(url, Object.assign({}, requestParams));
  } catch (e) {
    console.error(e);
    throw new AuthRetryableFetchError(_getErrorMessage2(e), 0);
  }
  if (!result.ok) {
    await handleError2(result);
  }
  if (options === null || options === void 0 ? void 0 : options.noResolveJson) {
    return result;
  }
  try {
    return await result.json();
  } catch (e) {
    await handleError2(e);
  }
}
__name(_handleRequest2, "_handleRequest");
function _sessionResponse(data) {
  var _a;
  let session = null;
  if (hasSession(data)) {
    session = Object.assign({}, data);
    if (!data.expires_at) {
      session.expires_at = expiresAt(data.expires_in);
    }
  }
  const user = (_a = data.user) !== null && _a !== void 0 ? _a : data;
  return { data: { session, user }, error: null };
}
__name(_sessionResponse, "_sessionResponse");
function _sessionResponsePassword(data) {
  const response = _sessionResponse(data);
  if (!response.error && data.weak_password && typeof data.weak_password === "object" && Array.isArray(data.weak_password.reasons) && data.weak_password.reasons.length && data.weak_password.message && typeof data.weak_password.message === "string" && data.weak_password.reasons.reduce((a, i) => a && typeof i === "string", true)) {
    response.data.weak_password = data.weak_password;
  }
  return response;
}
__name(_sessionResponsePassword, "_sessionResponsePassword");
function _userResponse(data) {
  var _a;
  const user = (_a = data.user) !== null && _a !== void 0 ? _a : data;
  return { data: { user }, error: null };
}
__name(_userResponse, "_userResponse");
function _ssoResponse(data) {
  return { data, error: null };
}
__name(_ssoResponse, "_ssoResponse");
function _generateLinkResponse(data) {
  const { action_link, email_otp, hashed_token, redirect_to, verification_type } = data, rest = __rest(data, ["action_link", "email_otp", "hashed_token", "redirect_to", "verification_type"]);
  const properties = {
    action_link,
    email_otp,
    hashed_token,
    redirect_to,
    verification_type
  };
  const user = Object.assign({}, rest);
  return {
    data: {
      properties,
      user
    },
    error: null
  };
}
__name(_generateLinkResponse, "_generateLinkResponse");
function _noResolveJsonResponse(data) {
  return data;
}
__name(_noResolveJsonResponse, "_noResolveJsonResponse");
function hasSession(data) {
  return data.access_token && data.refresh_token && data.expires_in;
}
__name(hasSession, "hasSession");

// node_modules/@supabase/auth-js/dist/module/lib/types.js
var SIGN_OUT_SCOPES = ["global", "local", "others"];

// node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.js
var GoTrueAdminApi = class {
  static {
    __name(this, "GoTrueAdminApi");
  }
  /**
   * Creates an admin API client that can be used to manage users and OAuth clients.
   *
   * @example
   * ```ts
   * import { GoTrueAdminApi } from '@supabase/auth-js'
   *
   * const admin = new GoTrueAdminApi({
   *   url: 'https://xyzcompany.supabase.co/auth/v1',
   *   headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
   * })
   * ```
   */
  constructor({ url = "", headers = {}, fetch: fetch2 }) {
    this.url = url;
    this.headers = headers;
    this.fetch = resolveFetch3(fetch2);
    this.mfa = {
      listFactors: this._listFactors.bind(this),
      deleteFactor: this._deleteFactor.bind(this)
    };
    this.oauth = {
      listClients: this._listOAuthClients.bind(this),
      createClient: this._createOAuthClient.bind(this),
      getClient: this._getOAuthClient.bind(this),
      updateClient: this._updateOAuthClient.bind(this),
      deleteClient: this._deleteOAuthClient.bind(this),
      regenerateClientSecret: this._regenerateOAuthClientSecret.bind(this)
    };
  }
  /**
   * Removes a logged-in session.
   * @param jwt A valid, logged-in JWT.
   * @param scope The logout sope.
   */
  async signOut(jwt, scope = SIGN_OUT_SCOPES[0]) {
    if (SIGN_OUT_SCOPES.indexOf(scope) < 0) {
      throw new Error(`@supabase/auth-js: Parameter scope must be one of ${SIGN_OUT_SCOPES.join(", ")}`);
    }
    try {
      await _request(this.fetch, "POST", `${this.url}/logout?scope=${scope}`, {
        headers: this.headers,
        jwt,
        noResolveJson: true
      });
      return { data: null, error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  /**
   * Sends an invite link to an email address.
   * @param email The email address of the user.
   * @param options Additional options to be included when inviting.
   */
  async inviteUserByEmail(email, options = {}) {
    try {
      return await _request(this.fetch, "POST", `${this.url}/invite`, {
        body: { email, data: options.data },
        headers: this.headers,
        redirectTo: options.redirectTo,
        xform: _userResponse
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error };
      }
      throw error;
    }
  }
  /**
   * Generates email links and OTPs to be sent via a custom email provider.
   * @param email The user's email.
   * @param options.password User password. For signup only.
   * @param options.data Optional user metadata. For signup only.
   * @param options.redirectTo The redirect url which should be appended to the generated link
   */
  async generateLink(params) {
    try {
      const { options } = params, rest = __rest(params, ["options"]);
      const body = Object.assign(Object.assign({}, rest), options);
      if ("newEmail" in rest) {
        body.new_email = rest === null || rest === void 0 ? void 0 : rest.newEmail;
        delete body["newEmail"];
      }
      return await _request(this.fetch, "POST", `${this.url}/admin/generate_link`, {
        body,
        headers: this.headers,
        xform: _generateLinkResponse,
        redirectTo: options === null || options === void 0 ? void 0 : options.redirectTo
      });
    } catch (error) {
      if (isAuthError(error)) {
        return {
          data: {
            properties: null,
            user: null
          },
          error
        };
      }
      throw error;
    }
  }
  // User Admin API
  /**
   * Creates a new user.
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async createUser(attributes) {
    try {
      return await _request(this.fetch, "POST", `${this.url}/admin/users`, {
        body: attributes,
        headers: this.headers,
        xform: _userResponse
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error };
      }
      throw error;
    }
  }
  /**
   * Get a list of users.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   * @param params An object which supports `page` and `perPage` as numbers, to alter the paginated results.
   */
  async listUsers(params) {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
      const pagination = { nextPage: null, lastPage: 0, total: 0 };
      const response = await _request(this.fetch, "GET", `${this.url}/admin/users`, {
        headers: this.headers,
        noResolveJson: true,
        query: {
          page: (_b = (_a = params === null || params === void 0 ? void 0 : params.page) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : "",
          per_page: (_d = (_c = params === null || params === void 0 ? void 0 : params.perPage) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ""
        },
        xform: _noResolveJsonResponse
      });
      if (response.error)
        throw response.error;
      const users = await response.json();
      const total = (_e = response.headers.get("x-total-count")) !== null && _e !== void 0 ? _e : 0;
      const links = (_g = (_f = response.headers.get("link")) === null || _f === void 0 ? void 0 : _f.split(",")) !== null && _g !== void 0 ? _g : [];
      if (links.length > 0) {
        links.forEach((link) => {
          const page = parseInt(link.split(";")[0].split("=")[1].substring(0, 1));
          const rel = JSON.parse(link.split(";")[1].split("=")[1]);
          pagination[`${rel}Page`] = page;
        });
        pagination.total = parseInt(total);
      }
      return { data: Object.assign(Object.assign({}, users), pagination), error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { users: [] }, error };
      }
      throw error;
    }
  }
  /**
   * Get user by id.
   *
   * @param uid The user's unique identifier
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async getUserById(uid) {
    validateUUID(uid);
    try {
      return await _request(this.fetch, "GET", `${this.url}/admin/users/${uid}`, {
        headers: this.headers,
        xform: _userResponse
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error };
      }
      throw error;
    }
  }
  /**
   * Updates the user data. Changes are applied directly without confirmation flows.
   *
   * @param uid The user's unique identifier
   * @param attributes The data you want to update.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @remarks
   * **Important:** This is a server-side operation and does **not** trigger client-side
   * `onAuthStateChange` listeners. The admin API has no connection to client state.
   *
   * To sync changes to the client after calling this method:
   * 1. On the client, call `supabase.auth.refreshSession()` to fetch the updated user data
   * 2. This will trigger the `TOKEN_REFRESHED` event and notify all listeners
   *
   * @example
   * ```typescript
   * // Server-side (Edge Function)
   * const { data, error } = await supabase.auth.admin.updateUserById(
   *   userId,
   *   { user_metadata: { preferences: { theme: 'dark' } } }
   * )
   *
   * // Client-side (to sync the changes)
   * const { data, error } = await supabase.auth.refreshSession()
   * // onAuthStateChange listeners will now be notified with updated user
   * ```
   *
   * @see {@link GoTrueClient.refreshSession} for syncing admin changes to the client
   * @see {@link GoTrueClient.updateUser} for client-side user updates (triggers listeners automatically)
   */
  async updateUserById(uid, attributes) {
    validateUUID(uid);
    try {
      return await _request(this.fetch, "PUT", `${this.url}/admin/users/${uid}`, {
        body: attributes,
        headers: this.headers,
        xform: _userResponse
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error };
      }
      throw error;
    }
  }
  /**
   * Delete a user. Requires a `service_role` key.
   *
   * @param id The user id you want to remove.
   * @param shouldSoftDelete If true, then the user will be soft-deleted from the auth schema. Soft deletion allows user identification from the hashed user ID but is not reversible.
   * Defaults to false for backward compatibility.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async deleteUser(id, shouldSoftDelete = false) {
    validateUUID(id);
    try {
      return await _request(this.fetch, "DELETE", `${this.url}/admin/users/${id}`, {
        headers: this.headers,
        body: {
          should_soft_delete: shouldSoftDelete
        },
        xform: _userResponse
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error };
      }
      throw error;
    }
  }
  async _listFactors(params) {
    validateUUID(params.userId);
    try {
      const { data, error } = await _request(this.fetch, "GET", `${this.url}/admin/users/${params.userId}/factors`, {
        headers: this.headers,
        xform: /* @__PURE__ */ __name((factors) => {
          return { data: { factors }, error: null };
        }, "xform")
      });
      return { data, error };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  async _deleteFactor(params) {
    validateUUID(params.userId);
    validateUUID(params.id);
    try {
      const data = await _request(this.fetch, "DELETE", `${this.url}/admin/users/${params.userId}/factors/${params.id}`, {
        headers: this.headers
      });
      return { data, error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  /**
   * Lists all OAuth clients with optional pagination.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _listOAuthClients(params) {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
      const pagination = { nextPage: null, lastPage: 0, total: 0 };
      const response = await _request(this.fetch, "GET", `${this.url}/admin/oauth/clients`, {
        headers: this.headers,
        noResolveJson: true,
        query: {
          page: (_b = (_a = params === null || params === void 0 ? void 0 : params.page) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : "",
          per_page: (_d = (_c = params === null || params === void 0 ? void 0 : params.perPage) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ""
        },
        xform: _noResolveJsonResponse
      });
      if (response.error)
        throw response.error;
      const clients = await response.json();
      const total = (_e = response.headers.get("x-total-count")) !== null && _e !== void 0 ? _e : 0;
      const links = (_g = (_f = response.headers.get("link")) === null || _f === void 0 ? void 0 : _f.split(",")) !== null && _g !== void 0 ? _g : [];
      if (links.length > 0) {
        links.forEach((link) => {
          const page = parseInt(link.split(";")[0].split("=")[1].substring(0, 1));
          const rel = JSON.parse(link.split(";")[1].split("=")[1]);
          pagination[`${rel}Page`] = page;
        });
        pagination.total = parseInt(total);
      }
      return { data: Object.assign(Object.assign({}, clients), pagination), error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { clients: [] }, error };
      }
      throw error;
    }
  }
  /**
   * Creates a new OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _createOAuthClient(params) {
    try {
      return await _request(this.fetch, "POST", `${this.url}/admin/oauth/clients`, {
        body: params,
        headers: this.headers,
        xform: /* @__PURE__ */ __name((client) => {
          return { data: client, error: null };
        }, "xform")
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  /**
   * Gets details of a specific OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _getOAuthClient(clientId) {
    try {
      return await _request(this.fetch, "GET", `${this.url}/admin/oauth/clients/${clientId}`, {
        headers: this.headers,
        xform: /* @__PURE__ */ __name((client) => {
          return { data: client, error: null };
        }, "xform")
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  /**
   * Updates an existing OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _updateOAuthClient(clientId, params) {
    try {
      return await _request(this.fetch, "PUT", `${this.url}/admin/oauth/clients/${clientId}`, {
        body: params,
        headers: this.headers,
        xform: /* @__PURE__ */ __name((client) => {
          return { data: client, error: null };
        }, "xform")
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  /**
   * Deletes an OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _deleteOAuthClient(clientId) {
    try {
      await _request(this.fetch, "DELETE", `${this.url}/admin/oauth/clients/${clientId}`, {
        headers: this.headers,
        noResolveJson: true
      });
      return { data: null, error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  /**
   * Regenerates the secret for an OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _regenerateOAuthClientSecret(clientId) {
    try {
      return await _request(this.fetch, "POST", `${this.url}/admin/oauth/clients/${clientId}/regenerate_secret`, {
        headers: this.headers,
        xform: /* @__PURE__ */ __name((client) => {
          return { data: client, error: null };
        }, "xform")
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
};

// node_modules/@supabase/auth-js/dist/module/lib/local-storage.js
function memoryLocalStorageAdapter(store = {}) {
  return {
    getItem: /* @__PURE__ */ __name((key) => {
      return store[key] || null;
    }, "getItem"),
    setItem: /* @__PURE__ */ __name((key, value) => {
      store[key] = value;
    }, "setItem"),
    removeItem: /* @__PURE__ */ __name((key) => {
      delete store[key];
    }, "removeItem")
  };
}
__name(memoryLocalStorageAdapter, "memoryLocalStorageAdapter");

// node_modules/@supabase/auth-js/dist/module/lib/locks.js
var internals = {
  /**
   * @experimental
   */
  debug: !!(globalThis && supportsLocalStorage() && globalThis.localStorage && globalThis.localStorage.getItem("supabase.gotrue-js.locks.debug") === "true")
};
var LockAcquireTimeoutError = class extends Error {
  static {
    __name(this, "LockAcquireTimeoutError");
  }
  constructor(message2) {
    super(message2);
    this.isAcquireTimeout = true;
  }
};
var NavigatorLockAcquireTimeoutError = class extends LockAcquireTimeoutError {
  static {
    __name(this, "NavigatorLockAcquireTimeoutError");
  }
};
async function navigatorLock(name, acquireTimeout, fn) {
  if (internals.debug) {
    console.log("@supabase/gotrue-js: navigatorLock: acquire lock", name, acquireTimeout);
  }
  const abortController = new globalThis.AbortController();
  if (acquireTimeout > 0) {
    setTimeout(() => {
      abortController.abort();
      if (internals.debug) {
        console.log("@supabase/gotrue-js: navigatorLock acquire timed out", name);
      }
    }, acquireTimeout);
  }
  await Promise.resolve();
  try {
    return await globalThis.navigator.locks.request(name, acquireTimeout === 0 ? {
      mode: "exclusive",
      ifAvailable: true
    } : {
      mode: "exclusive",
      signal: abortController.signal
    }, async (lock) => {
      if (lock) {
        if (internals.debug) {
          console.log("@supabase/gotrue-js: navigatorLock: acquired", name, lock.name);
        }
        try {
          return await fn();
        } finally {
          if (internals.debug) {
            console.log("@supabase/gotrue-js: navigatorLock: released", name, lock.name);
          }
        }
      } else {
        if (acquireTimeout === 0) {
          if (internals.debug) {
            console.log("@supabase/gotrue-js: navigatorLock: not immediately available", name);
          }
          throw new NavigatorLockAcquireTimeoutError(`Acquiring an exclusive Navigator LockManager lock "${name}" immediately failed`);
        } else {
          if (internals.debug) {
            try {
              const result = await globalThis.navigator.locks.query();
              console.log("@supabase/gotrue-js: Navigator LockManager state", JSON.stringify(result, null, "  "));
            } catch (e) {
              console.warn("@supabase/gotrue-js: Error when querying Navigator LockManager state", e);
            }
          }
          console.warn("@supabase/gotrue-js: Navigator LockManager returned a null lock when using #request without ifAvailable set to true, it appears this browser is not following the LockManager spec https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request");
          return await fn();
        }
      }
    });
  } catch (e) {
    if ((e === null || e === void 0 ? void 0 : e.name) === "AbortError") {
      throw new NavigatorLockAcquireTimeoutError(`Acquiring an exclusive Navigator LockManager lock "${name}" timed out waiting ${acquireTimeout}ms`);
    }
    throw e;
  }
}
__name(navigatorLock, "navigatorLock");

// node_modules/@supabase/auth-js/dist/module/lib/polyfills.js
function polyfillGlobalThis() {
  if (typeof globalThis === "object")
    return;
  try {
    Object.defineProperty(Object.prototype, "__magic__", {
      get: /* @__PURE__ */ __name(function() {
        return this;
      }, "get"),
      configurable: true
    });
    __magic__.globalThis = __magic__;
    delete Object.prototype.__magic__;
  } catch (e) {
    if (typeof self !== "undefined") {
      self.globalThis = self;
    }
  }
}
__name(polyfillGlobalThis, "polyfillGlobalThis");

// node_modules/@supabase/auth-js/dist/module/lib/web3/ethereum.js
function getAddress(address) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`@supabase/auth-js: Address "${address}" is invalid.`);
  }
  return address.toLowerCase();
}
__name(getAddress, "getAddress");
function fromHex(hex) {
  return parseInt(hex, 16);
}
__name(fromHex, "fromHex");
function toHex(value) {
  const bytes = new TextEncoder().encode(value);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return "0x" + hex;
}
__name(toHex, "toHex");
function createSiweMessage(parameters) {
  var _a;
  const { chainId, domain, expirationTime, issuedAt = /* @__PURE__ */ new Date(), nonce, notBefore, requestId, resources, scheme, uri, version: version5 } = parameters;
  {
    if (!Number.isInteger(chainId))
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${chainId}`);
    if (!domain)
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.`);
    if (nonce && nonce.length < 8)
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${nonce}`);
    if (!uri)
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.`);
    if (version5 !== "1")
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${version5}`);
    if ((_a = parameters.statement) === null || _a === void 0 ? void 0 : _a.includes("\n"))
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${parameters.statement}`);
  }
  const address = getAddress(parameters.address);
  const origin = scheme ? `${scheme}://${domain}` : domain;
  const statement = parameters.statement ? `${parameters.statement}
` : "";
  const prefix = `${origin} wants you to sign in with your Ethereum account:
${address}

${statement}`;
  let suffix = `URI: ${uri}
Version: ${version5}
Chain ID: ${chainId}${nonce ? `
Nonce: ${nonce}` : ""}
Issued At: ${issuedAt.toISOString()}`;
  if (expirationTime)
    suffix += `
Expiration Time: ${expirationTime.toISOString()}`;
  if (notBefore)
    suffix += `
Not Before: ${notBefore.toISOString()}`;
  if (requestId)
    suffix += `
Request ID: ${requestId}`;
  if (resources) {
    let content = "\nResources:";
    for (const resource of resources) {
      if (!resource || typeof resource !== "string")
        throw new Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${resource}`);
      content += `
- ${resource}`;
    }
    suffix += content;
  }
  return `${prefix}
${suffix}`;
}
__name(createSiweMessage, "createSiweMessage");

// node_modules/@supabase/auth-js/dist/module/lib/webauthn.errors.js
var WebAuthnError = class extends Error {
  static {
    __name(this, "WebAuthnError");
  }
  constructor({ message: message2, code, cause, name }) {
    var _a;
    super(message2, { cause });
    this.__isWebAuthnError = true;
    this.name = (_a = name !== null && name !== void 0 ? name : cause instanceof Error ? cause.name : void 0) !== null && _a !== void 0 ? _a : "Unknown Error";
    this.code = code;
  }
};
var WebAuthnUnknownError = class extends WebAuthnError {
  static {
    __name(this, "WebAuthnUnknownError");
  }
  constructor(message2, originalError) {
    super({
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: originalError,
      message: message2
    });
    this.name = "WebAuthnUnknownError";
    this.originalError = originalError;
  }
};
function identifyRegistrationError({ error, options }) {
  var _a, _b, _c;
  const { publicKey } = options;
  if (!publicKey) {
    throw Error("options was missing required publicKey property");
  }
  if (error.name === "AbortError") {
    if (options.signal instanceof AbortSignal) {
      return new WebAuthnError({
        message: "Registration ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: error
      });
    }
  } else if (error.name === "ConstraintError") {
    if (((_a = publicKey.authenticatorSelection) === null || _a === void 0 ? void 0 : _a.requireResidentKey) === true) {
      return new WebAuthnError({
        message: "Discoverable credentials were required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
        cause: error
      });
    } else if (
      // @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
      options.mediation === "conditional" && ((_b = publicKey.authenticatorSelection) === null || _b === void 0 ? void 0 : _b.userVerification) === "required"
    ) {
      return new WebAuthnError({
        message: "User verification was required during automatic registration but it could not be performed",
        code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
        cause: error
      });
    } else if (((_c = publicKey.authenticatorSelection) === null || _c === void 0 ? void 0 : _c.userVerification) === "required") {
      return new WebAuthnError({
        message: "User verification was required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
        cause: error
      });
    }
  } else if (error.name === "InvalidStateError") {
    return new WebAuthnError({
      message: "The authenticator was previously registered",
      code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
      cause: error
    });
  } else if (error.name === "NotAllowedError") {
    return new WebAuthnError({
      message: error.message,
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: error
    });
  } else if (error.name === "NotSupportedError") {
    const validPubKeyCredParams = publicKey.pubKeyCredParams.filter((param) => param.type === "public-key");
    if (validPubKeyCredParams.length === 0) {
      return new WebAuthnError({
        message: 'No entry in pubKeyCredParams was of type "public-key"',
        code: "ERROR_MALFORMED_PUBKEYCREDPARAMS",
        cause: error
      });
    }
    return new WebAuthnError({
      message: "No available authenticator supported any of the specified pubKeyCredParams algorithms",
      code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
      cause: error
    });
  } else if (error.name === "SecurityError") {
    const effectiveDomain = window.location.hostname;
    if (!isValidDomain(effectiveDomain)) {
      return new WebAuthnError({
        message: `${window.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: error
      });
    } else if (publicKey.rp.id !== effectiveDomain) {
      return new WebAuthnError({
        message: `The RP ID "${publicKey.rp.id}" is invalid for this domain`,
        code: "ERROR_INVALID_RP_ID",
        cause: error
      });
    }
  } else if (error.name === "TypeError") {
    if (publicKey.user.id.byteLength < 1 || publicKey.user.id.byteLength > 64) {
      return new WebAuthnError({
        message: "User ID was not between 1 and 64 characters",
        code: "ERROR_INVALID_USER_ID_LENGTH",
        cause: error
      });
    }
  } else if (error.name === "UnknownError") {
    return new WebAuthnError({
      message: "The authenticator was unable to process the specified options, or could not create a new credential",
      code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
      cause: error
    });
  }
  return new WebAuthnError({
    message: "a Non-Webauthn related error has occurred",
    code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
    cause: error
  });
}
__name(identifyRegistrationError, "identifyRegistrationError");
function identifyAuthenticationError({ error, options }) {
  const { publicKey } = options;
  if (!publicKey) {
    throw Error("options was missing required publicKey property");
  }
  if (error.name === "AbortError") {
    if (options.signal instanceof AbortSignal) {
      return new WebAuthnError({
        message: "Authentication ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: error
      });
    }
  } else if (error.name === "NotAllowedError") {
    return new WebAuthnError({
      message: error.message,
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: error
    });
  } else if (error.name === "SecurityError") {
    const effectiveDomain = window.location.hostname;
    if (!isValidDomain(effectiveDomain)) {
      return new WebAuthnError({
        message: `${window.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: error
      });
    } else if (publicKey.rpId !== effectiveDomain) {
      return new WebAuthnError({
        message: `The RP ID "${publicKey.rpId}" is invalid for this domain`,
        code: "ERROR_INVALID_RP_ID",
        cause: error
      });
    }
  } else if (error.name === "UnknownError") {
    return new WebAuthnError({
      message: "The authenticator was unable to process the specified options, or could not create a new assertion signature",
      code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
      cause: error
    });
  }
  return new WebAuthnError({
    message: "a Non-Webauthn related error has occurred",
    code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
    cause: error
  });
}
__name(identifyAuthenticationError, "identifyAuthenticationError");

// node_modules/@supabase/auth-js/dist/module/lib/webauthn.js
var WebAuthnAbortService = class {
  static {
    __name(this, "WebAuthnAbortService");
  }
  /**
   * Create an abort signal for a new WebAuthn operation.
   * Automatically cancels any existing operation.
   *
   * @returns {AbortSignal} Signal to pass to navigator.credentials.create() or .get()
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal MDN - AbortSignal}
   */
  createNewAbortSignal() {
    if (this.controller) {
      const abortError = new Error("Cancelling existing WebAuthn API call for new one");
      abortError.name = "AbortError";
      this.controller.abort(abortError);
    }
    const newController = new AbortController();
    this.controller = newController;
    return newController.signal;
  }
  /**
   * Manually cancel the current WebAuthn operation.
   * Useful for cleaning up when user cancels or navigates away.
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort MDN - AbortController.abort}
   */
  cancelCeremony() {
    if (this.controller) {
      const abortError = new Error("Manually cancelling existing WebAuthn API call");
      abortError.name = "AbortError";
      this.controller.abort(abortError);
      this.controller = void 0;
    }
  }
};
var webAuthnAbortService = new WebAuthnAbortService();
function deserializeCredentialCreationOptions(options) {
  if (!options) {
    throw new Error("Credential creation options are required");
  }
  if (typeof PublicKeyCredential !== "undefined" && "parseCreationOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseCreationOptionsFromJSON === "function") {
    return PublicKeyCredential.parseCreationOptionsFromJSON(
      /** we assert the options here as typescript still doesn't know about future webauthn types */
      options
    );
  }
  const { challenge: challengeStr, user: userOpts, excludeCredentials } = options, restOptions = __rest(
    options,
    ["challenge", "user", "excludeCredentials"]
  );
  const challenge = base64UrlToUint8Array(challengeStr).buffer;
  const user = Object.assign(Object.assign({}, userOpts), { id: base64UrlToUint8Array(userOpts.id).buffer });
  const result = Object.assign(Object.assign({}, restOptions), {
    challenge,
    user
  });
  if (excludeCredentials && excludeCredentials.length > 0) {
    result.excludeCredentials = new Array(excludeCredentials.length);
    for (let i = 0; i < excludeCredentials.length; i++) {
      const cred = excludeCredentials[i];
      result.excludeCredentials[i] = Object.assign(Object.assign({}, cred), {
        id: base64UrlToUint8Array(cred.id).buffer,
        type: cred.type || "public-key",
        // Cast transports to handle future transport types like "cable"
        transports: cred.transports
      });
    }
  }
  return result;
}
__name(deserializeCredentialCreationOptions, "deserializeCredentialCreationOptions");
function deserializeCredentialRequestOptions(options) {
  if (!options) {
    throw new Error("Credential request options are required");
  }
  if (typeof PublicKeyCredential !== "undefined" && "parseRequestOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseRequestOptionsFromJSON === "function") {
    return PublicKeyCredential.parseRequestOptionsFromJSON(options);
  }
  const { challenge: challengeStr, allowCredentials } = options, restOptions = __rest(
    options,
    ["challenge", "allowCredentials"]
  );
  const challenge = base64UrlToUint8Array(challengeStr).buffer;
  const result = Object.assign(Object.assign({}, restOptions), { challenge });
  if (allowCredentials && allowCredentials.length > 0) {
    result.allowCredentials = new Array(allowCredentials.length);
    for (let i = 0; i < allowCredentials.length; i++) {
      const cred = allowCredentials[i];
      result.allowCredentials[i] = Object.assign(Object.assign({}, cred), {
        id: base64UrlToUint8Array(cred.id).buffer,
        type: cred.type || "public-key",
        // Cast transports to handle future transport types like "cable"
        transports: cred.transports
      });
    }
  }
  return result;
}
__name(deserializeCredentialRequestOptions, "deserializeCredentialRequestOptions");
function serializeCredentialCreationResponse(credential) {
  var _a;
  if ("toJSON" in credential && typeof credential.toJSON === "function") {
    return credential.toJSON();
  }
  const credentialWithAttachment = credential;
  return {
    id: credential.id,
    rawId: credential.id,
    response: {
      attestationObject: bytesToBase64URL(new Uint8Array(credential.response.attestationObject)),
      clientDataJSON: bytesToBase64URL(new Uint8Array(credential.response.clientDataJSON))
    },
    type: "public-key",
    clientExtensionResults: credential.getClientExtensionResults(),
    // Convert null to undefined and cast to AuthenticatorAttachment type
    authenticatorAttachment: (_a = credentialWithAttachment.authenticatorAttachment) !== null && _a !== void 0 ? _a : void 0
  };
}
__name(serializeCredentialCreationResponse, "serializeCredentialCreationResponse");
function serializeCredentialRequestResponse(credential) {
  var _a;
  if ("toJSON" in credential && typeof credential.toJSON === "function") {
    return credential.toJSON();
  }
  const credentialWithAttachment = credential;
  const clientExtensionResults = credential.getClientExtensionResults();
  const assertionResponse = credential.response;
  return {
    id: credential.id,
    rawId: credential.id,
    // W3C spec expects rawId to match id for JSON format
    response: {
      authenticatorData: bytesToBase64URL(new Uint8Array(assertionResponse.authenticatorData)),
      clientDataJSON: bytesToBase64URL(new Uint8Array(assertionResponse.clientDataJSON)),
      signature: bytesToBase64URL(new Uint8Array(assertionResponse.signature)),
      userHandle: assertionResponse.userHandle ? bytesToBase64URL(new Uint8Array(assertionResponse.userHandle)) : void 0
    },
    type: "public-key",
    clientExtensionResults,
    // Convert null to undefined and cast to AuthenticatorAttachment type
    authenticatorAttachment: (_a = credentialWithAttachment.authenticatorAttachment) !== null && _a !== void 0 ? _a : void 0
  };
}
__name(serializeCredentialRequestResponse, "serializeCredentialRequestResponse");
function isValidDomain(hostname) {
  return (
    // Consider localhost valid as well since it's okay wrt Secure Contexts
    hostname === "localhost" || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(hostname)
  );
}
__name(isValidDomain, "isValidDomain");
function browserSupportsWebAuthn() {
  var _a, _b;
  return !!(isBrowser() && "PublicKeyCredential" in window && window.PublicKeyCredential && "credentials" in navigator && typeof ((_a = navigator === null || navigator === void 0 ? void 0 : navigator.credentials) === null || _a === void 0 ? void 0 : _a.create) === "function" && typeof ((_b = navigator === null || navigator === void 0 ? void 0 : navigator.credentials) === null || _b === void 0 ? void 0 : _b.get) === "function");
}
__name(browserSupportsWebAuthn, "browserSupportsWebAuthn");
async function createCredential(options) {
  try {
    const response = await navigator.credentials.create(
      /** we assert the type here until typescript types are updated */
      options
    );
    if (!response) {
      return {
        data: null,
        error: new WebAuthnUnknownError("Empty credential response", response)
      };
    }
    if (!(response instanceof PublicKeyCredential)) {
      return {
        data: null,
        error: new WebAuthnUnknownError("Browser returned unexpected credential type", response)
      };
    }
    return { data: response, error: null };
  } catch (err) {
    return {
      data: null,
      error: identifyRegistrationError({
        error: err,
        options
      })
    };
  }
}
__name(createCredential, "createCredential");
async function getCredential(options) {
  try {
    const response = await navigator.credentials.get(
      /** we assert the type here until typescript types are updated */
      options
    );
    if (!response) {
      return {
        data: null,
        error: new WebAuthnUnknownError("Empty credential response", response)
      };
    }
    if (!(response instanceof PublicKeyCredential)) {
      return {
        data: null,
        error: new WebAuthnUnknownError("Browser returned unexpected credential type", response)
      };
    }
    return { data: response, error: null };
  } catch (err) {
    return {
      data: null,
      error: identifyAuthenticationError({
        error: err,
        options
      })
    };
  }
}
__name(getCredential, "getCredential");
var DEFAULT_CREATION_OPTIONS = {
  hints: ["security-key"],
  authenticatorSelection: {
    authenticatorAttachment: "cross-platform",
    requireResidentKey: false,
    /** set to preferred because older yubikeys don't have PIN/Biometric */
    userVerification: "preferred",
    residentKey: "discouraged"
  },
  attestation: "direct"
};
var DEFAULT_REQUEST_OPTIONS = {
  /** set to preferred because older yubikeys don't have PIN/Biometric */
  userVerification: "preferred",
  hints: ["security-key"],
  attestation: "direct"
};
function deepMerge(...sources) {
  const isObject2 = /* @__PURE__ */ __name((val) => val !== null && typeof val === "object" && !Array.isArray(val), "isObject");
  const isArrayBufferLike = /* @__PURE__ */ __name((val) => val instanceof ArrayBuffer || ArrayBuffer.isView(val), "isArrayBufferLike");
  const result = {};
  for (const source of sources) {
    if (!source)
      continue;
    for (const key in source) {
      const value = source[key];
      if (value === void 0)
        continue;
      if (Array.isArray(value)) {
        result[key] = value;
      } else if (isArrayBufferLike(value)) {
        result[key] = value;
      } else if (isObject2(value)) {
        const existing = result[key];
        if (isObject2(existing)) {
          result[key] = deepMerge(existing, value);
        } else {
          result[key] = deepMerge(value);
        }
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}
__name(deepMerge, "deepMerge");
function mergeCredentialCreationOptions(baseOptions, overrides) {
  return deepMerge(DEFAULT_CREATION_OPTIONS, baseOptions, overrides || {});
}
__name(mergeCredentialCreationOptions, "mergeCredentialCreationOptions");
function mergeCredentialRequestOptions(baseOptions, overrides) {
  return deepMerge(DEFAULT_REQUEST_OPTIONS, baseOptions, overrides || {});
}
__name(mergeCredentialRequestOptions, "mergeCredentialRequestOptions");
var WebAuthnApi = class {
  static {
    __name(this, "WebAuthnApi");
  }
  constructor(client) {
    this.client = client;
    this.enroll = this._enroll.bind(this);
    this.challenge = this._challenge.bind(this);
    this.verify = this._verify.bind(this);
    this.authenticate = this._authenticate.bind(this);
    this.register = this._register.bind(this);
  }
  /**
   * Enroll a new WebAuthn factor.
   * Creates an unverified WebAuthn factor that must be verified with a credential.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Omit<MFAEnrollWebauthnParams, 'factorType'>} params - Enrollment parameters (friendlyName required)
   * @returns {Promise<AuthMFAEnrollWebauthnResponse>} Enrolled factor details or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registering a New Credential}
   */
  async _enroll(params) {
    return this.client.mfa.enroll(Object.assign(Object.assign({}, params), { factorType: "webauthn" }));
  }
  /**
   * Challenge for WebAuthn credential creation or authentication.
   * Combines server challenge with browser credential operations.
   * Handles both registration (create) and authentication (request) flows.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {MFAChallengeWebauthnParams & { friendlyName?: string; signal?: AbortSignal }} params - Challenge parameters including factorId
   * @param {Object} overrides - Allows you to override the parameters passed to navigator.credentials
   * @param {PublicKeyCredentialCreationOptionsFuture} overrides.create - Override options for credential creation
   * @param {PublicKeyCredentialRequestOptionsFuture} overrides.request - Override options for credential request
   * @returns {Promise<RequestResult>} Challenge response with credential or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-credential-creation W3C WebAuthn Spec - Credential Creation}
   * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying Assertion}
   */
  async _challenge({ factorId, webauthn, friendlyName, signal }, overrides) {
    var _a;
    try {
      const { data: challengeResponse, error: challengeError } = await this.client.mfa.challenge({
        factorId,
        webauthn
      });
      if (!challengeResponse) {
        return { data: null, error: challengeError };
      }
      const abortSignal = signal !== null && signal !== void 0 ? signal : webAuthnAbortService.createNewAbortSignal();
      if (challengeResponse.webauthn.type === "create") {
        const { user } = challengeResponse.webauthn.credential_options.publicKey;
        if (!user.name) {
          const nameToUse = friendlyName;
          if (!nameToUse) {
            const currentUser = await this.client.getUser();
            const userData = currentUser.data.user;
            const fallbackName = ((_a = userData === null || userData === void 0 ? void 0 : userData.user_metadata) === null || _a === void 0 ? void 0 : _a.name) || (userData === null || userData === void 0 ? void 0 : userData.email) || (userData === null || userData === void 0 ? void 0 : userData.id) || "User";
            user.name = `${user.id}:${fallbackName}`;
          } else {
            user.name = `${user.id}:${nameToUse}`;
          }
        }
        if (!user.displayName) {
          user.displayName = user.name;
        }
      }
      switch (challengeResponse.webauthn.type) {
        case "create": {
          const options = mergeCredentialCreationOptions(challengeResponse.webauthn.credential_options.publicKey, overrides === null || overrides === void 0 ? void 0 : overrides.create);
          const { data, error } = await createCredential({
            publicKey: options,
            signal: abortSignal
          });
          if (data) {
            return {
              data: {
                factorId,
                challengeId: challengeResponse.id,
                webauthn: {
                  type: challengeResponse.webauthn.type,
                  credential_response: data
                }
              },
              error: null
            };
          }
          return { data: null, error };
        }
        case "request": {
          const options = mergeCredentialRequestOptions(challengeResponse.webauthn.credential_options.publicKey, overrides === null || overrides === void 0 ? void 0 : overrides.request);
          const { data, error } = await getCredential(Object.assign(Object.assign({}, challengeResponse.webauthn.credential_options), { publicKey: options, signal: abortSignal }));
          if (data) {
            return {
              data: {
                factorId,
                challengeId: challengeResponse.id,
                webauthn: {
                  type: challengeResponse.webauthn.type,
                  credential_response: data
                }
              },
              error: null
            };
          }
          return { data: null, error };
        }
      }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      return {
        data: null,
        error: new AuthUnknownError("Unexpected error in challenge", error)
      };
    }
  }
  /**
   * Verify a WebAuthn credential with the server.
   * Completes the WebAuthn ceremony by sending the credential to the server for verification.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Verification parameters
   * @param {string} params.challengeId - ID of the challenge being verified
   * @param {string} params.factorId - ID of the WebAuthn factor
   * @param {MFAVerifyWebauthnParams<T>['webauthn']} params.webauthn - WebAuthn credential response
   * @returns {Promise<AuthMFAVerifyResponse>} Verification result with session or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying an Authentication Assertion}
   * */
  async _verify({ challengeId, factorId, webauthn }) {
    return this.client.mfa.verify({
      factorId,
      challengeId,
      webauthn
    });
  }
  /**
   * Complete WebAuthn authentication flow.
   * Performs challenge and verification in a single operation for existing credentials.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Authentication parameters
   * @param {string} params.factorId - ID of the WebAuthn factor to authenticate with
   * @param {Object} params.webauthn - WebAuthn configuration
   * @param {string} params.webauthn.rpId - Relying Party ID (defaults to current hostname)
   * @param {string[]} params.webauthn.rpOrigins - Allowed origins (defaults to current origin)
   * @param {AbortSignal} params.webauthn.signal - Optional abort signal
   * @param {PublicKeyCredentialRequestOptionsFuture} overrides - Override options for navigator.credentials.get
   * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Authentication result
   * @see {@link https://w3c.github.io/webauthn/#sctn-authentication W3C WebAuthn Spec - Authentication Ceremony}
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialRequestOptions MDN - PublicKeyCredentialRequestOptions}
   */
  async _authenticate({ factorId, webauthn: { rpId = typeof window !== "undefined" ? window.location.hostname : void 0, rpOrigins = typeof window !== "undefined" ? [window.location.origin] : void 0, signal } = {} }, overrides) {
    if (!rpId) {
      return {
        data: null,
        error: new AuthError("rpId is required for WebAuthn authentication")
      };
    }
    try {
      if (!browserSupportsWebAuthn()) {
        return {
          data: null,
          error: new AuthUnknownError("Browser does not support WebAuthn", null)
        };
      }
      const { data: challengeResponse, error: challengeError } = await this.challenge({
        factorId,
        webauthn: { rpId, rpOrigins },
        signal
      }, { request: overrides });
      if (!challengeResponse) {
        return { data: null, error: challengeError };
      }
      const { webauthn } = challengeResponse;
      return this._verify({
        factorId,
        challengeId: challengeResponse.challengeId,
        webauthn: {
          type: webauthn.type,
          rpId,
          rpOrigins,
          credential_response: webauthn.credential_response
        }
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      return {
        data: null,
        error: new AuthUnknownError("Unexpected error in authenticate", error)
      };
    }
  }
  /**
   * Complete WebAuthn registration flow.
   * Performs enrollment, challenge, and verification in a single operation for new credentials.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Registration parameters
   * @param {string} params.friendlyName - User-friendly name for the credential
   * @param {string} params.rpId - Relying Party ID (defaults to current hostname)
   * @param {string[]} params.rpOrigins - Allowed origins (defaults to current origin)
   * @param {AbortSignal} params.signal - Optional abort signal
   * @param {PublicKeyCredentialCreationOptionsFuture} overrides - Override options for navigator.credentials.create
   * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Registration result
   * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registration Ceremony}
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions MDN - PublicKeyCredentialCreationOptions}
   */
  async _register({ friendlyName, webauthn: { rpId = typeof window !== "undefined" ? window.location.hostname : void 0, rpOrigins = typeof window !== "undefined" ? [window.location.origin] : void 0, signal } = {} }, overrides) {
    if (!rpId) {
      return {
        data: null,
        error: new AuthError("rpId is required for WebAuthn registration")
      };
    }
    try {
      if (!browserSupportsWebAuthn()) {
        return {
          data: null,
          error: new AuthUnknownError("Browser does not support WebAuthn", null)
        };
      }
      const { data: factor, error: enrollError } = await this._enroll({
        friendlyName
      });
      if (!factor) {
        await this.client.mfa.listFactors().then((factors) => {
          var _a;
          return (_a = factors.data) === null || _a === void 0 ? void 0 : _a.all.find((v) => v.factor_type === "webauthn" && v.friendly_name === friendlyName && v.status !== "unverified");
        }).then((factor2) => factor2 ? this.client.mfa.unenroll({ factorId: factor2 === null || factor2 === void 0 ? void 0 : factor2.id }) : void 0);
        return { data: null, error: enrollError };
      }
      const { data: challengeResponse, error: challengeError } = await this._challenge({
        factorId: factor.id,
        friendlyName: factor.friendly_name,
        webauthn: { rpId, rpOrigins },
        signal
      }, {
        create: overrides
      });
      if (!challengeResponse) {
        return { data: null, error: challengeError };
      }
      return this._verify({
        factorId: factor.id,
        challengeId: challengeResponse.challengeId,
        webauthn: {
          rpId,
          rpOrigins,
          type: challengeResponse.webauthn.type,
          credential_response: challengeResponse.webauthn.credential_response
        }
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      return {
        data: null,
        error: new AuthUnknownError("Unexpected error in register", error)
      };
    }
  }
};

// node_modules/@supabase/auth-js/dist/module/GoTrueClient.js
polyfillGlobalThis();
var DEFAULT_OPTIONS = {
  url: GOTRUE_URL,
  storageKey: STORAGE_KEY,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  headers: DEFAULT_HEADERS2,
  flowType: "implicit",
  debug: false,
  hasCustomAuthorizationHeader: false,
  throwOnError: false,
  lockAcquireTimeout: 1e4,
  // 10 seconds
  skipAutoInitialize: false
};
async function lockNoOp(name, acquireTimeout, fn) {
  return await fn();
}
__name(lockNoOp, "lockNoOp");
var GLOBAL_JWKS = {};
var GoTrueClient = class _GoTrueClient {
  static {
    __name(this, "GoTrueClient");
  }
  /**
   * The JWKS used for verifying asymmetric JWTs
   */
  get jwks() {
    var _a, _b;
    return (_b = (_a = GLOBAL_JWKS[this.storageKey]) === null || _a === void 0 ? void 0 : _a.jwks) !== null && _b !== void 0 ? _b : { keys: [] };
  }
  set jwks(value) {
    GLOBAL_JWKS[this.storageKey] = Object.assign(Object.assign({}, GLOBAL_JWKS[this.storageKey]), { jwks: value });
  }
  get jwks_cached_at() {
    var _a, _b;
    return (_b = (_a = GLOBAL_JWKS[this.storageKey]) === null || _a === void 0 ? void 0 : _a.cachedAt) !== null && _b !== void 0 ? _b : Number.MIN_SAFE_INTEGER;
  }
  set jwks_cached_at(value) {
    GLOBAL_JWKS[this.storageKey] = Object.assign(Object.assign({}, GLOBAL_JWKS[this.storageKey]), { cachedAt: value });
  }
  /**
   * Create a new client for use in the browser.
   *
   * @example
   * ```ts
   * import { GoTrueClient } from '@supabase/auth-js'
   *
   * const auth = new GoTrueClient({
   *   url: 'https://xyzcompany.supabase.co/auth/v1',
   *   headers: { apikey: 'public-anon-key' },
   *   storageKey: 'supabase-auth',
   * })
   * ```
   */
  constructor(options) {
    var _a, _b, _c;
    this.userStorage = null;
    this.memoryStorage = null;
    this.stateChangeEmitters = /* @__PURE__ */ new Map();
    this.autoRefreshTicker = null;
    this.autoRefreshTickTimeout = null;
    this.visibilityChangedCallback = null;
    this.refreshingDeferred = null;
    this.initializePromise = null;
    this.detectSessionInUrl = true;
    this.hasCustomAuthorizationHeader = false;
    this.suppressGetSessionWarning = false;
    this.lockAcquired = false;
    this.pendingInLock = [];
    this.broadcastChannel = null;
    this.logger = console.log;
    const settings = Object.assign(Object.assign({}, DEFAULT_OPTIONS), options);
    this.storageKey = settings.storageKey;
    this.instanceID = (_a = _GoTrueClient.nextInstanceID[this.storageKey]) !== null && _a !== void 0 ? _a : 0;
    _GoTrueClient.nextInstanceID[this.storageKey] = this.instanceID + 1;
    this.logDebugMessages = !!settings.debug;
    if (typeof settings.debug === "function") {
      this.logger = settings.debug;
    }
    if (this.instanceID > 0 && isBrowser()) {
      const message2 = `${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;
      console.warn(message2);
      if (this.logDebugMessages) {
        console.trace(message2);
      }
    }
    this.persistSession = settings.persistSession;
    this.autoRefreshToken = settings.autoRefreshToken;
    this.admin = new GoTrueAdminApi({
      url: settings.url,
      headers: settings.headers,
      fetch: settings.fetch
    });
    this.url = settings.url;
    this.headers = settings.headers;
    this.fetch = resolveFetch3(settings.fetch);
    this.lock = settings.lock || lockNoOp;
    this.detectSessionInUrl = settings.detectSessionInUrl;
    this.flowType = settings.flowType;
    this.hasCustomAuthorizationHeader = settings.hasCustomAuthorizationHeader;
    this.throwOnError = settings.throwOnError;
    this.lockAcquireTimeout = settings.lockAcquireTimeout;
    if (settings.lock) {
      this.lock = settings.lock;
    } else if (this.persistSession && isBrowser() && ((_b = globalThis === null || globalThis === void 0 ? void 0 : globalThis.navigator) === null || _b === void 0 ? void 0 : _b.locks)) {
      this.lock = navigatorLock;
    } else {
      this.lock = lockNoOp;
    }
    if (!this.jwks) {
      this.jwks = { keys: [] };
      this.jwks_cached_at = Number.MIN_SAFE_INTEGER;
    }
    this.mfa = {
      verify: this._verify.bind(this),
      enroll: this._enroll.bind(this),
      unenroll: this._unenroll.bind(this),
      challenge: this._challenge.bind(this),
      listFactors: this._listFactors.bind(this),
      challengeAndVerify: this._challengeAndVerify.bind(this),
      getAuthenticatorAssuranceLevel: this._getAuthenticatorAssuranceLevel.bind(this),
      webauthn: new WebAuthnApi(this)
    };
    this.oauth = {
      getAuthorizationDetails: this._getAuthorizationDetails.bind(this),
      approveAuthorization: this._approveAuthorization.bind(this),
      denyAuthorization: this._denyAuthorization.bind(this),
      listGrants: this._listOAuthGrants.bind(this),
      revokeGrant: this._revokeOAuthGrant.bind(this)
    };
    if (this.persistSession) {
      if (settings.storage) {
        this.storage = settings.storage;
      } else {
        if (supportsLocalStorage()) {
          this.storage = globalThis.localStorage;
        } else {
          this.memoryStorage = {};
          this.storage = memoryLocalStorageAdapter(this.memoryStorage);
        }
      }
      if (settings.userStorage) {
        this.userStorage = settings.userStorage;
      }
    } else {
      this.memoryStorage = {};
      this.storage = memoryLocalStorageAdapter(this.memoryStorage);
    }
    if (isBrowser() && globalThis.BroadcastChannel && this.persistSession && this.storageKey) {
      try {
        this.broadcastChannel = new globalThis.BroadcastChannel(this.storageKey);
      } catch (e) {
        console.error("Failed to create a new BroadcastChannel, multi-tab state changes will not be available", e);
      }
      (_c = this.broadcastChannel) === null || _c === void 0 ? void 0 : _c.addEventListener("message", async (event) => {
        this._debug("received broadcast notification from other tab or client", event);
        try {
          await this._notifyAllSubscribers(event.data.event, event.data.session, false);
        } catch (error) {
          this._debug("#broadcastChannel", "error", error);
        }
      });
    }
    if (!settings.skipAutoInitialize) {
      this.initialize().catch((error) => {
        this._debug("#initialize()", "error", error);
      });
    }
  }
  /**
   * Returns whether error throwing mode is enabled for this client.
   */
  isThrowOnErrorEnabled() {
    return this.throwOnError;
  }
  /**
   * Centralizes return handling with optional error throwing. When `throwOnError` is enabled
   * and the provided result contains a non-nullish error, the error is thrown instead of
   * being returned. This ensures consistent behavior across all public API methods.
   */
  _returnResult(result) {
    if (this.throwOnError && result && result.error) {
      throw result.error;
    }
    return result;
  }
  _logPrefix() {
    return `GoTrueClient@${this.storageKey}:${this.instanceID} (${version3}) ${(/* @__PURE__ */ new Date()).toISOString()}`;
  }
  _debug(...args) {
    if (this.logDebugMessages) {
      this.logger(this._logPrefix(), ...args);
    }
    return this;
  }
  /**
   * Initializes the client session either from the url or from storage.
   * This method is automatically called when instantiating the client, but should also be called
   * manually when checking for an error from an auth redirect (oauth, magiclink, password recovery, etc).
   */
  async initialize() {
    if (this.initializePromise) {
      return await this.initializePromise;
    }
    this.initializePromise = (async () => {
      return await this._acquireLock(this.lockAcquireTimeout, async () => {
        return await this._initialize();
      });
    })();
    return await this.initializePromise;
  }
  /**
   * IMPORTANT:
   * 1. Never throw in this method, as it is called from the constructor
   * 2. Never return a session from this method as it would be cached over
   *    the whole lifetime of the client
   */
  async _initialize() {
    var _a;
    try {
      let params = {};
      let callbackUrlType = "none";
      if (isBrowser()) {
        params = parseParametersFromURL(window.location.href);
        if (this._isImplicitGrantCallback(params)) {
          callbackUrlType = "implicit";
        } else if (await this._isPKCECallback(params)) {
          callbackUrlType = "pkce";
        }
      }
      if (isBrowser() && this.detectSessionInUrl && callbackUrlType !== "none") {
        const { data, error } = await this._getSessionFromURL(params, callbackUrlType);
        if (error) {
          this._debug("#_initialize()", "error detecting session from URL", error);
          if (isAuthImplicitGrantRedirectError(error)) {
            const errorCode = (_a = error.details) === null || _a === void 0 ? void 0 : _a.code;
            if (errorCode === "identity_already_exists" || errorCode === "identity_not_found" || errorCode === "single_identity_not_deletable") {
              return { error };
            }
          }
          return { error };
        }
        const { session, redirectType } = data;
        this._debug("#_initialize()", "detected session in URL", session, "redirect type", redirectType);
        await this._saveSession(session);
        setTimeout(async () => {
          if (redirectType === "recovery") {
            await this._notifyAllSubscribers("PASSWORD_RECOVERY", session);
          } else {
            await this._notifyAllSubscribers("SIGNED_IN", session);
          }
        }, 0);
        return { error: null };
      }
      await this._recoverAndRefresh();
      return { error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ error });
      }
      return this._returnResult({
        error: new AuthUnknownError("Unexpected error during initialization", error)
      });
    } finally {
      await this._handleVisibilityChange();
      this._debug("#_initialize()", "end");
    }
  }
  /**
   * Creates a new anonymous user.
   *
   * @returns A session where the is_anonymous claim in the access token JWT set to true
   */
  async signInAnonymously(credentials) {
    var _a, _b, _c;
    try {
      const res = await _request(this.fetch, "POST", `${this.url}/signup`, {
        headers: this.headers,
        body: {
          data: (_b = (_a = credentials === null || credentials === void 0 ? void 0 : credentials.options) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : {},
          gotrue_meta_security: { captcha_token: (_c = credentials === null || credentials === void 0 ? void 0 : credentials.options) === null || _c === void 0 ? void 0 : _c.captchaToken }
        },
        xform: _sessionResponse
      });
      const { data, error } = res;
      if (error || !data) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      const session = data.session;
      const user = data.user;
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", session);
      }
      return this._returnResult({ data: { user, session }, error: null });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Creates a new user.
   *
   * Be aware that if a user account exists in the system you may get back an
   * error message that attempts to hide this information from the user.
   * This method has support for PKCE via email signups. The PKCE flow cannot be used when autoconfirm is enabled.
   *
   * @returns A logged-in session if the server has "autoconfirm" ON
   * @returns A user if the server has "autoconfirm" OFF
   */
  async signUp(credentials) {
    var _a, _b, _c;
    try {
      let res;
      if ("email" in credentials) {
        const { email, password, options } = credentials;
        let codeChallenge = null;
        let codeChallengeMethod = null;
        if (this.flowType === "pkce") {
          ;
          [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(this.storage, this.storageKey);
        }
        res = await _request(this.fetch, "POST", `${this.url}/signup`, {
          headers: this.headers,
          redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo,
          body: {
            email,
            password,
            data: (_a = options === null || options === void 0 ? void 0 : options.data) !== null && _a !== void 0 ? _a : {},
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken },
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod
          },
          xform: _sessionResponse
        });
      } else if ("phone" in credentials) {
        const { phone, password, options } = credentials;
        res = await _request(this.fetch, "POST", `${this.url}/signup`, {
          headers: this.headers,
          body: {
            phone,
            password,
            data: (_b = options === null || options === void 0 ? void 0 : options.data) !== null && _b !== void 0 ? _b : {},
            channel: (_c = options === null || options === void 0 ? void 0 : options.channel) !== null && _c !== void 0 ? _c : "sms",
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
          },
          xform: _sessionResponse
        });
      } else {
        throw new AuthInvalidCredentialsError("You must provide either an email or phone number and a password");
      }
      const { data, error } = res;
      if (error || !data) {
        await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      const session = data.session;
      const user = data.user;
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", session);
      }
      return this._returnResult({ data: { user, session }, error: null });
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Log in an existing user with an email and password or phone and password.
   *
   * Be aware that you may get back an error message that will not distinguish
   * between the cases where the account does not exist or that the
   * email/phone and password combination is wrong or that the account can only
   * be accessed via social login.
   */
  async signInWithPassword(credentials) {
    try {
      let res;
      if ("email" in credentials) {
        const { email, password, options } = credentials;
        res = await _request(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
          headers: this.headers,
          body: {
            email,
            password,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
          },
          xform: _sessionResponsePassword
        });
      } else if ("phone" in credentials) {
        const { phone, password, options } = credentials;
        res = await _request(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
          headers: this.headers,
          body: {
            phone,
            password,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
          },
          xform: _sessionResponsePassword
        });
      } else {
        throw new AuthInvalidCredentialsError("You must provide either an email or phone number and a password");
      }
      const { data, error } = res;
      if (error) {
        return this._returnResult({ data: { user: null, session: null }, error });
      } else if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError();
        return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
      }
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", data.session);
      }
      return this._returnResult({
        data: Object.assign({ user: data.user, session: data.session }, data.weak_password ? { weakPassword: data.weak_password } : null),
        error
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Log in an existing user via a third-party provider.
   * This method supports the PKCE flow.
   */
  async signInWithOAuth(credentials) {
    var _a, _b, _c, _d;
    return await this._handleProviderSignIn(credentials.provider, {
      redirectTo: (_a = credentials.options) === null || _a === void 0 ? void 0 : _a.redirectTo,
      scopes: (_b = credentials.options) === null || _b === void 0 ? void 0 : _b.scopes,
      queryParams: (_c = credentials.options) === null || _c === void 0 ? void 0 : _c.queryParams,
      skipBrowserRedirect: (_d = credentials.options) === null || _d === void 0 ? void 0 : _d.skipBrowserRedirect
    });
  }
  /**
   * Log in an existing user by exchanging an Auth Code issued during the PKCE flow.
   */
  async exchangeCodeForSession(authCode) {
    await this.initializePromise;
    return this._acquireLock(this.lockAcquireTimeout, async () => {
      return this._exchangeCodeForSession(authCode);
    });
  }
  /**
   * Signs in a user by verifying a message signed by the user's private key.
   * Supports Ethereum (via Sign-In-With-Ethereum) & Solana (Sign-In-With-Solana) standards,
   * both of which derive from the EIP-4361 standard
   * With slight variation on Solana's side.
   * @reference https://eips.ethereum.org/EIPS/eip-4361
   */
  async signInWithWeb3(credentials) {
    const { chain } = credentials;
    switch (chain) {
      case "ethereum":
        return await this.signInWithEthereum(credentials);
      case "solana":
        return await this.signInWithSolana(credentials);
      default:
        throw new Error(`@supabase/auth-js: Unsupported chain "${chain}"`);
    }
  }
  async signInWithEthereum(credentials) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    let message2;
    let signature;
    if ("message" in credentials) {
      message2 = credentials.message;
      signature = credentials.signature;
    } else {
      const { chain, wallet, statement, options } = credentials;
      let resolvedWallet;
      if (!isBrowser()) {
        if (typeof wallet !== "object" || !(options === null || options === void 0 ? void 0 : options.url)) {
          throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
        }
        resolvedWallet = wallet;
      } else if (typeof wallet === "object") {
        resolvedWallet = wallet;
      } else {
        const windowAny = window;
        if ("ethereum" in windowAny && typeof windowAny.ethereum === "object" && "request" in windowAny.ethereum && typeof windowAny.ethereum.request === "function") {
          resolvedWallet = windowAny.ethereum;
        } else {
          throw new Error(`@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.`);
        }
      }
      const url = new URL((_a = options === null || options === void 0 ? void 0 : options.url) !== null && _a !== void 0 ? _a : window.location.href);
      const accounts = await resolvedWallet.request({
        method: "eth_requestAccounts"
      }).then((accs) => accs).catch(() => {
        throw new Error(`@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid`);
      });
      if (!accounts || accounts.length === 0) {
        throw new Error(`@supabase/auth-js: No accounts available. Please ensure the wallet is connected.`);
      }
      const address = getAddress(accounts[0]);
      let chainId = (_b = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _b === void 0 ? void 0 : _b.chainId;
      if (!chainId) {
        const chainIdHex = await resolvedWallet.request({
          method: "eth_chainId"
        });
        chainId = fromHex(chainIdHex);
      }
      const siweMessage = {
        domain: url.host,
        address,
        statement,
        uri: url.href,
        version: "1",
        chainId,
        nonce: (_c = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _c === void 0 ? void 0 : _c.nonce,
        issuedAt: (_e = (_d = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _d === void 0 ? void 0 : _d.issuedAt) !== null && _e !== void 0 ? _e : /* @__PURE__ */ new Date(),
        expirationTime: (_f = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _f === void 0 ? void 0 : _f.expirationTime,
        notBefore: (_g = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _g === void 0 ? void 0 : _g.notBefore,
        requestId: (_h = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _h === void 0 ? void 0 : _h.requestId,
        resources: (_j = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _j === void 0 ? void 0 : _j.resources
      };
      message2 = createSiweMessage(siweMessage);
      signature = await resolvedWallet.request({
        method: "personal_sign",
        params: [toHex(message2), address]
      });
    }
    try {
      const { data, error } = await _request(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
        headers: this.headers,
        body: Object.assign({
          chain: "ethereum",
          message: message2,
          signature
        }, ((_k = credentials.options) === null || _k === void 0 ? void 0 : _k.captchaToken) ? { gotrue_meta_security: { captcha_token: (_l = credentials.options) === null || _l === void 0 ? void 0 : _l.captchaToken } } : null),
        xform: _sessionResponse
      });
      if (error) {
        throw error;
      }
      if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError();
        return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
      }
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", data.session);
      }
      return this._returnResult({ data: Object.assign({}, data), error });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  async signInWithSolana(credentials) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    let message2;
    let signature;
    if ("message" in credentials) {
      message2 = credentials.message;
      signature = credentials.signature;
    } else {
      const { chain, wallet, statement, options } = credentials;
      let resolvedWallet;
      if (!isBrowser()) {
        if (typeof wallet !== "object" || !(options === null || options === void 0 ? void 0 : options.url)) {
          throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
        }
        resolvedWallet = wallet;
      } else if (typeof wallet === "object") {
        resolvedWallet = wallet;
      } else {
        const windowAny = window;
        if ("solana" in windowAny && typeof windowAny.solana === "object" && ("signIn" in windowAny.solana && typeof windowAny.solana.signIn === "function" || "signMessage" in windowAny.solana && typeof windowAny.solana.signMessage === "function")) {
          resolvedWallet = windowAny.solana;
        } else {
          throw new Error(`@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.`);
        }
      }
      const url = new URL((_a = options === null || options === void 0 ? void 0 : options.url) !== null && _a !== void 0 ? _a : window.location.href);
      if ("signIn" in resolvedWallet && resolvedWallet.signIn) {
        const output = await resolvedWallet.signIn(Object.assign(Object.assign(Object.assign({ issuedAt: (/* @__PURE__ */ new Date()).toISOString() }, options === null || options === void 0 ? void 0 : options.signInWithSolana), {
          // non-overridable properties
          version: "1",
          domain: url.host,
          uri: url.href
        }), statement ? { statement } : null));
        let outputToProcess;
        if (Array.isArray(output) && output[0] && typeof output[0] === "object") {
          outputToProcess = output[0];
        } else if (output && typeof output === "object" && "signedMessage" in output && "signature" in output) {
          outputToProcess = output;
        } else {
          throw new Error("@supabase/auth-js: Wallet method signIn() returned unrecognized value");
        }
        if ("signedMessage" in outputToProcess && "signature" in outputToProcess && (typeof outputToProcess.signedMessage === "string" || outputToProcess.signedMessage instanceof Uint8Array) && outputToProcess.signature instanceof Uint8Array) {
          message2 = typeof outputToProcess.signedMessage === "string" ? outputToProcess.signedMessage : new TextDecoder().decode(outputToProcess.signedMessage);
          signature = outputToProcess.signature;
        } else {
          throw new Error("@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields");
        }
      } else {
        if (!("signMessage" in resolvedWallet) || typeof resolvedWallet.signMessage !== "function" || !("publicKey" in resolvedWallet) || typeof resolvedWallet !== "object" || !resolvedWallet.publicKey || !("toBase58" in resolvedWallet.publicKey) || typeof resolvedWallet.publicKey.toBase58 !== "function") {
          throw new Error("@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API");
        }
        message2 = [
          `${url.host} wants you to sign in with your Solana account:`,
          resolvedWallet.publicKey.toBase58(),
          ...statement ? ["", statement, ""] : [""],
          "Version: 1",
          `URI: ${url.href}`,
          `Issued At: ${(_c = (_b = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _b === void 0 ? void 0 : _b.issuedAt) !== null && _c !== void 0 ? _c : (/* @__PURE__ */ new Date()).toISOString()}`,
          ...((_d = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _d === void 0 ? void 0 : _d.notBefore) ? [`Not Before: ${options.signInWithSolana.notBefore}`] : [],
          ...((_e = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _e === void 0 ? void 0 : _e.expirationTime) ? [`Expiration Time: ${options.signInWithSolana.expirationTime}`] : [],
          ...((_f = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _f === void 0 ? void 0 : _f.chainId) ? [`Chain ID: ${options.signInWithSolana.chainId}`] : [],
          ...((_g = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _g === void 0 ? void 0 : _g.nonce) ? [`Nonce: ${options.signInWithSolana.nonce}`] : [],
          ...((_h = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _h === void 0 ? void 0 : _h.requestId) ? [`Request ID: ${options.signInWithSolana.requestId}`] : [],
          ...((_k = (_j = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _j === void 0 ? void 0 : _j.resources) === null || _k === void 0 ? void 0 : _k.length) ? [
            "Resources",
            ...options.signInWithSolana.resources.map((resource) => `- ${resource}`)
          ] : []
        ].join("\n");
        const maybeSignature = await resolvedWallet.signMessage(new TextEncoder().encode(message2), "utf8");
        if (!maybeSignature || !(maybeSignature instanceof Uint8Array)) {
          throw new Error("@supabase/auth-js: Wallet signMessage() API returned an recognized value");
        }
        signature = maybeSignature;
      }
    }
    try {
      const { data, error } = await _request(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
        headers: this.headers,
        body: Object.assign({ chain: "solana", message: message2, signature: bytesToBase64URL(signature) }, ((_l = credentials.options) === null || _l === void 0 ? void 0 : _l.captchaToken) ? { gotrue_meta_security: { captcha_token: (_m = credentials.options) === null || _m === void 0 ? void 0 : _m.captchaToken } } : null),
        xform: _sessionResponse
      });
      if (error) {
        throw error;
      }
      if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError();
        return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
      }
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", data.session);
      }
      return this._returnResult({ data: Object.assign({}, data), error });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  async _exchangeCodeForSession(authCode) {
    const storageItem = await getItemAsync(this.storage, `${this.storageKey}-code-verifier`);
    const [codeVerifier, redirectType] = (storageItem !== null && storageItem !== void 0 ? storageItem : "").split("/");
    try {
      if (!codeVerifier && this.flowType === "pkce") {
        throw new AuthPKCECodeVerifierMissingError();
      }
      const { data, error } = await _request(this.fetch, "POST", `${this.url}/token?grant_type=pkce`, {
        headers: this.headers,
        body: {
          auth_code: authCode,
          code_verifier: codeVerifier
        },
        xform: _sessionResponse
      });
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (error) {
        throw error;
      }
      if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError();
        return this._returnResult({
          data: { user: null, session: null, redirectType: null },
          error: invalidTokenError
        });
      }
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", data.session);
      }
      return this._returnResult({ data: Object.assign(Object.assign({}, data), { redirectType: redirectType !== null && redirectType !== void 0 ? redirectType : null }), error });
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (isAuthError(error)) {
        return this._returnResult({
          data: { user: null, session: null, redirectType: null },
          error
        });
      }
      throw error;
    }
  }
  /**
   * Allows signing in with an OIDC ID token. The authentication provider used
   * should be enabled and configured.
   */
  async signInWithIdToken(credentials) {
    try {
      const { options, provider, token, access_token, nonce } = credentials;
      const res = await _request(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
        headers: this.headers,
        body: {
          provider,
          id_token: token,
          access_token,
          nonce,
          gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
        },
        xform: _sessionResponse
      });
      const { data, error } = res;
      if (error) {
        return this._returnResult({ data: { user: null, session: null }, error });
      } else if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError();
        return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
      }
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", data.session);
      }
      return this._returnResult({ data, error });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Log in a user using magiclink or a one-time password (OTP).
   *
   * If the `{{ .ConfirmationURL }}` variable is specified in the email template, a magiclink will be sent.
   * If the `{{ .Token }}` variable is specified in the email template, an OTP will be sent.
   * If you're using phone sign-ins, only an OTP will be sent. You won't be able to send a magiclink for phone sign-ins.
   *
   * Be aware that you may get back an error message that will not distinguish
   * between the cases where the account does not exist or, that the account
   * can only be accessed via social login.
   *
   * Do note that you will need to configure a Whatsapp sender on Twilio
   * if you are using phone sign in with the 'whatsapp' channel. The whatsapp
   * channel is not supported on other providers
   * at this time.
   * This method supports PKCE when an email is passed.
   */
  async signInWithOtp(credentials) {
    var _a, _b, _c, _d, _e;
    try {
      if ("email" in credentials) {
        const { email, options } = credentials;
        let codeChallenge = null;
        let codeChallengeMethod = null;
        if (this.flowType === "pkce") {
          ;
          [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(this.storage, this.storageKey);
        }
        const { error } = await _request(this.fetch, "POST", `${this.url}/otp`, {
          headers: this.headers,
          body: {
            email,
            data: (_a = options === null || options === void 0 ? void 0 : options.data) !== null && _a !== void 0 ? _a : {},
            create_user: (_b = options === null || options === void 0 ? void 0 : options.shouldCreateUser) !== null && _b !== void 0 ? _b : true,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken },
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod
          },
          redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo
        });
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      if ("phone" in credentials) {
        const { phone, options } = credentials;
        const { data, error } = await _request(this.fetch, "POST", `${this.url}/otp`, {
          headers: this.headers,
          body: {
            phone,
            data: (_c = options === null || options === void 0 ? void 0 : options.data) !== null && _c !== void 0 ? _c : {},
            create_user: (_d = options === null || options === void 0 ? void 0 : options.shouldCreateUser) !== null && _d !== void 0 ? _d : true,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken },
            channel: (_e = options === null || options === void 0 ? void 0 : options.channel) !== null && _e !== void 0 ? _e : "sms"
          }
        });
        return this._returnResult({
          data: { user: null, session: null, messageId: data === null || data === void 0 ? void 0 : data.message_id },
          error
        });
      }
      throw new AuthInvalidCredentialsError("You must provide either an email or phone number.");
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Log in a user given a User supplied OTP or TokenHash received through mobile or email.
   */
  async verifyOtp(params) {
    var _a, _b;
    try {
      let redirectTo = void 0;
      let captchaToken = void 0;
      if ("options" in params) {
        redirectTo = (_a = params.options) === null || _a === void 0 ? void 0 : _a.redirectTo;
        captchaToken = (_b = params.options) === null || _b === void 0 ? void 0 : _b.captchaToken;
      }
      const { data, error } = await _request(this.fetch, "POST", `${this.url}/verify`, {
        headers: this.headers,
        body: Object.assign(Object.assign({}, params), { gotrue_meta_security: { captcha_token: captchaToken } }),
        redirectTo,
        xform: _sessionResponse
      });
      if (error) {
        throw error;
      }
      if (!data) {
        const tokenVerificationError = new Error("An error occurred on token verification.");
        throw tokenVerificationError;
      }
      const session = data.session;
      const user = data.user;
      if (session === null || session === void 0 ? void 0 : session.access_token) {
        await this._saveSession(session);
        await this._notifyAllSubscribers(params.type == "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", session);
      }
      return this._returnResult({ data: { user, session }, error: null });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Attempts a single-sign on using an enterprise Identity Provider. A
   * successful SSO attempt will redirect the current page to the identity
   * provider authorization page. The redirect URL is implementation and SSO
   * protocol specific.
   *
   * You can use it by providing a SSO domain. Typically you can extract this
   * domain by asking users for their email address. If this domain is
   * registered on the Auth instance the redirect will use that organization's
   * currently active SSO Identity Provider for the login.
   *
   * If you have built an organization-specific login page, you can use the
   * organization's SSO Identity Provider UUID directly instead.
   */
  async signInWithSSO(params) {
    var _a, _b, _c, _d, _e;
    try {
      let codeChallenge = null;
      let codeChallengeMethod = null;
      if (this.flowType === "pkce") {
        ;
        [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(this.storage, this.storageKey);
      }
      const result = await _request(this.fetch, "POST", `${this.url}/sso`, {
        body: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, "providerId" in params ? { provider_id: params.providerId } : null), "domain" in params ? { domain: params.domain } : null), { redirect_to: (_b = (_a = params.options) === null || _a === void 0 ? void 0 : _a.redirectTo) !== null && _b !== void 0 ? _b : void 0 }), ((_c = params === null || params === void 0 ? void 0 : params.options) === null || _c === void 0 ? void 0 : _c.captchaToken) ? { gotrue_meta_security: { captcha_token: params.options.captchaToken } } : null), { skip_http_redirect: true, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod }),
        headers: this.headers,
        xform: _ssoResponse
      });
      if (((_d = result.data) === null || _d === void 0 ? void 0 : _d.url) && isBrowser() && !((_e = params.options) === null || _e === void 0 ? void 0 : _e.skipBrowserRedirect)) {
        window.location.assign(result.data.url);
      }
      return this._returnResult(result);
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Sends a reauthentication OTP to the user's email or phone number.
   * Requires the user to be signed-in.
   */
  async reauthenticate() {
    await this.initializePromise;
    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._reauthenticate();
    });
  }
  async _reauthenticate() {
    try {
      return await this._useSession(async (result) => {
        const { data: { session }, error: sessionError } = result;
        if (sessionError)
          throw sessionError;
        if (!session)
          throw new AuthSessionMissingError();
        const { error } = await _request(this.fetch, "GET", `${this.url}/reauthenticate`, {
          headers: this.headers,
          jwt: session.access_token
        });
        return this._returnResult({ data: { user: null, session: null }, error });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Resends an existing signup confirmation email, email change email, SMS OTP or phone change OTP.
   */
  async resend(credentials) {
    try {
      const endpoint = `${this.url}/resend`;
      if ("email" in credentials) {
        const { email, type, options } = credentials;
        const { error } = await _request(this.fetch, "POST", endpoint, {
          headers: this.headers,
          body: {
            email,
            type,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
          },
          redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo
        });
        return this._returnResult({ data: { user: null, session: null }, error });
      } else if ("phone" in credentials) {
        const { phone, type, options } = credentials;
        const { data, error } = await _request(this.fetch, "POST", endpoint, {
          headers: this.headers,
          body: {
            phone,
            type,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
          }
        });
        return this._returnResult({
          data: { user: null, session: null, messageId: data === null || data === void 0 ? void 0 : data.message_id },
          error
        });
      }
      throw new AuthInvalidCredentialsError("You must provide either an email or phone number and a type");
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Returns the session, refreshing it if necessary.
   *
   * The session returned can be null if the session is not detected which can happen in the event a user is not signed-in or has logged out.
   *
   * **IMPORTANT:** This method loads values directly from the storage attached
   * to the client. If that storage is based on request cookies for example,
   * the values in it may not be authentic and therefore it's strongly advised
   * against using this method and its results in such circumstances. A warning
   * will be emitted if this is detected. Use {@link #getUser()} instead.
   */
  async getSession() {
    await this.initializePromise;
    const result = await this._acquireLock(this.lockAcquireTimeout, async () => {
      return this._useSession(async (result2) => {
        return result2;
      });
    });
    return result;
  }
  /**
   * Acquires a global lock based on the storage key.
   */
  async _acquireLock(acquireTimeout, fn) {
    this._debug("#_acquireLock", "begin", acquireTimeout);
    try {
      if (this.lockAcquired) {
        const last = this.pendingInLock.length ? this.pendingInLock[this.pendingInLock.length - 1] : Promise.resolve();
        const result = (async () => {
          await last;
          return await fn();
        })();
        this.pendingInLock.push((async () => {
          try {
            await result;
          } catch (e) {
          }
        })());
        return result;
      }
      return await this.lock(`lock:${this.storageKey}`, acquireTimeout, async () => {
        this._debug("#_acquireLock", "lock acquired for storage key", this.storageKey);
        try {
          this.lockAcquired = true;
          const result = fn();
          this.pendingInLock.push((async () => {
            try {
              await result;
            } catch (e) {
            }
          })());
          await result;
          while (this.pendingInLock.length) {
            const waitOn = [...this.pendingInLock];
            await Promise.all(waitOn);
            this.pendingInLock.splice(0, waitOn.length);
          }
          return await result;
        } finally {
          this._debug("#_acquireLock", "lock released for storage key", this.storageKey);
          this.lockAcquired = false;
        }
      });
    } finally {
      this._debug("#_acquireLock", "end");
    }
  }
  /**
   * Use instead of {@link #getSession} inside the library. It is
   * semantically usually what you want, as getting a session involves some
   * processing afterwards that requires only one client operating on the
   * session at once across multiple tabs or processes.
   */
  async _useSession(fn) {
    this._debug("#_useSession", "begin");
    try {
      const result = await this.__loadSession();
      return await fn(result);
    } finally {
      this._debug("#_useSession", "end");
    }
  }
  /**
   * NEVER USE DIRECTLY!
   *
   * Always use {@link #_useSession}.
   */
  async __loadSession() {
    this._debug("#__loadSession()", "begin");
    if (!this.lockAcquired) {
      this._debug("#__loadSession()", "used outside of an acquired lock!", new Error().stack);
    }
    try {
      let currentSession = null;
      const maybeSession = await getItemAsync(this.storage, this.storageKey);
      this._debug("#getSession()", "session from storage", maybeSession);
      if (maybeSession !== null) {
        if (this._isValidSession(maybeSession)) {
          currentSession = maybeSession;
        } else {
          this._debug("#getSession()", "session from storage is not valid");
          await this._removeSession();
        }
      }
      if (!currentSession) {
        return { data: { session: null }, error: null };
      }
      const hasExpired = currentSession.expires_at ? currentSession.expires_at * 1e3 - Date.now() < EXPIRY_MARGIN_MS : false;
      this._debug("#__loadSession()", `session has${hasExpired ? "" : " not"} expired`, "expires_at", currentSession.expires_at);
      if (!hasExpired) {
        if (this.userStorage) {
          const maybeUser = await getItemAsync(this.userStorage, this.storageKey + "-user");
          if (maybeUser === null || maybeUser === void 0 ? void 0 : maybeUser.user) {
            currentSession.user = maybeUser.user;
          } else {
            currentSession.user = userNotAvailableProxy();
          }
        }
        if (this.storage.isServer && currentSession.user && !currentSession.user.__isUserNotAvailableProxy) {
          const suppressWarningRef = { value: this.suppressGetSessionWarning };
          currentSession.user = insecureUserWarningProxy(currentSession.user, suppressWarningRef);
          if (suppressWarningRef.value) {
            this.suppressGetSessionWarning = true;
          }
        }
        return { data: { session: currentSession }, error: null };
      }
      const { data: session, error } = await this._callRefreshToken(currentSession.refresh_token);
      if (error) {
        return this._returnResult({ data: { session: null }, error });
      }
      return this._returnResult({ data: { session }, error: null });
    } finally {
      this._debug("#__loadSession()", "end");
    }
  }
  /**
   * Gets the current user details if there is an existing session. This method
   * performs a network request to the Supabase Auth server, so the returned
   * value is authentic and can be used to base authorization rules on.
   *
   * @param jwt Takes in an optional access token JWT. If no JWT is provided, the JWT from the current session is used.
   */
  async getUser(jwt) {
    if (jwt) {
      return await this._getUser(jwt);
    }
    await this.initializePromise;
    const result = await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._getUser();
    });
    if (result.data.user) {
      this.suppressGetSessionWarning = true;
    }
    return result;
  }
  async _getUser(jwt) {
    try {
      if (jwt) {
        return await _request(this.fetch, "GET", `${this.url}/user`, {
          headers: this.headers,
          jwt,
          xform: _userResponse
        });
      }
      return await this._useSession(async (result) => {
        var _a, _b, _c;
        const { data, error } = result;
        if (error) {
          throw error;
        }
        if (!((_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token) && !this.hasCustomAuthorizationHeader) {
          return { data: { user: null }, error: new AuthSessionMissingError() };
        }
        return await _request(this.fetch, "GET", `${this.url}/user`, {
          headers: this.headers,
          jwt: (_c = (_b = data.session) === null || _b === void 0 ? void 0 : _b.access_token) !== null && _c !== void 0 ? _c : void 0,
          xform: _userResponse
        });
      });
    } catch (error) {
      if (isAuthError(error)) {
        if (isAuthSessionMissingError(error)) {
          await this._removeSession();
          await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
        }
        return this._returnResult({ data: { user: null }, error });
      }
      throw error;
    }
  }
  /**
   * Updates user data for a logged in user.
   */
  async updateUser(attributes, options = {}) {
    await this.initializePromise;
    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._updateUser(attributes, options);
    });
  }
  async _updateUser(attributes, options = {}) {
    try {
      return await this._useSession(async (result) => {
        const { data: sessionData, error: sessionError } = result;
        if (sessionError) {
          throw sessionError;
        }
        if (!sessionData.session) {
          throw new AuthSessionMissingError();
        }
        const session = sessionData.session;
        let codeChallenge = null;
        let codeChallengeMethod = null;
        if (this.flowType === "pkce" && attributes.email != null) {
          ;
          [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(this.storage, this.storageKey);
        }
        const { data, error: userError } = await _request(this.fetch, "PUT", `${this.url}/user`, {
          headers: this.headers,
          redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo,
          body: Object.assign(Object.assign({}, attributes), { code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod }),
          jwt: session.access_token,
          xform: _userResponse
        });
        if (userError) {
          throw userError;
        }
        session.user = data.user;
        await this._saveSession(session);
        await this._notifyAllSubscribers("USER_UPDATED", session);
        return this._returnResult({ data: { user: session.user }, error: null });
      });
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null }, error });
      }
      throw error;
    }
  }
  /**
   * Sets the session data from the current session. If the current session is expired, setSession will take care of refreshing it to obtain a new session.
   * If the refresh token or access token in the current session is invalid, an error will be thrown.
   * @param currentSession The current session that minimally contains an access token and refresh token.
   */
  async setSession(currentSession) {
    await this.initializePromise;
    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._setSession(currentSession);
    });
  }
  async _setSession(currentSession) {
    try {
      if (!currentSession.access_token || !currentSession.refresh_token) {
        throw new AuthSessionMissingError();
      }
      const timeNow = Date.now() / 1e3;
      let expiresAt2 = timeNow;
      let hasExpired = true;
      let session = null;
      const { payload } = decodeJWT(currentSession.access_token);
      if (payload.exp) {
        expiresAt2 = payload.exp;
        hasExpired = expiresAt2 <= timeNow;
      }
      if (hasExpired) {
        const { data: refreshedSession, error } = await this._callRefreshToken(currentSession.refresh_token);
        if (error) {
          return this._returnResult({ data: { user: null, session: null }, error });
        }
        if (!refreshedSession) {
          return { data: { user: null, session: null }, error: null };
        }
        session = refreshedSession;
      } else {
        const { data, error } = await this._getUser(currentSession.access_token);
        if (error) {
          return this._returnResult({ data: { user: null, session: null }, error });
        }
        session = {
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token,
          user: data.user,
          token_type: "bearer",
          expires_in: expiresAt2 - timeNow,
          expires_at: expiresAt2
        };
        await this._saveSession(session);
        await this._notifyAllSubscribers("SIGNED_IN", session);
      }
      return this._returnResult({ data: { user: session.user, session }, error: null });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { session: null, user: null }, error });
      }
      throw error;
    }
  }
  /**
   * Returns a new session, regardless of expiry status.
   * Takes in an optional current session. If not passed in, then refreshSession() will attempt to retrieve it from getSession().
   * If the current session's refresh token is invalid, an error will be thrown.
   * @param currentSession The current session. If passed in, it must contain a refresh token.
   */
  async refreshSession(currentSession) {
    await this.initializePromise;
    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._refreshSession(currentSession);
    });
  }
  async _refreshSession(currentSession) {
    try {
      return await this._useSession(async (result) => {
        var _a;
        if (!currentSession) {
          const { data, error: error2 } = result;
          if (error2) {
            throw error2;
          }
          currentSession = (_a = data.session) !== null && _a !== void 0 ? _a : void 0;
        }
        if (!(currentSession === null || currentSession === void 0 ? void 0 : currentSession.refresh_token)) {
          throw new AuthSessionMissingError();
        }
        const { data: session, error } = await this._callRefreshToken(currentSession.refresh_token);
        if (error) {
          return this._returnResult({ data: { user: null, session: null }, error });
        }
        if (!session) {
          return this._returnResult({ data: { user: null, session: null }, error: null });
        }
        return this._returnResult({ data: { user: session.user, session }, error: null });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Gets the session data from a URL string
   */
  async _getSessionFromURL(params, callbackUrlType) {
    try {
      if (!isBrowser())
        throw new AuthImplicitGrantRedirectError("No browser detected.");
      if (params.error || params.error_description || params.error_code) {
        throw new AuthImplicitGrantRedirectError(params.error_description || "Error in URL with unspecified error_description", {
          error: params.error || "unspecified_error",
          code: params.error_code || "unspecified_code"
        });
      }
      switch (callbackUrlType) {
        case "implicit":
          if (this.flowType === "pkce") {
            throw new AuthPKCEGrantCodeExchangeError("Not a valid PKCE flow url.");
          }
          break;
        case "pkce":
          if (this.flowType === "implicit") {
            throw new AuthImplicitGrantRedirectError("Not a valid implicit grant flow url.");
          }
          break;
        default:
      }
      if (callbackUrlType === "pkce") {
        this._debug("#_initialize()", "begin", "is PKCE flow", true);
        if (!params.code)
          throw new AuthPKCEGrantCodeExchangeError("No code detected.");
        const { data: data2, error: error2 } = await this._exchangeCodeForSession(params.code);
        if (error2)
          throw error2;
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        window.history.replaceState(window.history.state, "", url.toString());
        return { data: { session: data2.session, redirectType: null }, error: null };
      }
      const { provider_token, provider_refresh_token, access_token, refresh_token, expires_in, expires_at, token_type } = params;
      if (!access_token || !expires_in || !refresh_token || !token_type) {
        throw new AuthImplicitGrantRedirectError("No session defined in URL");
      }
      const timeNow = Math.round(Date.now() / 1e3);
      const expiresIn = parseInt(expires_in);
      let expiresAt2 = timeNow + expiresIn;
      if (expires_at) {
        expiresAt2 = parseInt(expires_at);
      }
      const actuallyExpiresIn = expiresAt2 - timeNow;
      if (actuallyExpiresIn * 1e3 <= AUTO_REFRESH_TICK_DURATION_MS) {
        console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${actuallyExpiresIn}s, should have been closer to ${expiresIn}s`);
      }
      const issuedAt = expiresAt2 - expiresIn;
      if (timeNow - issuedAt >= 120) {
        console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale", issuedAt, expiresAt2, timeNow);
      } else if (timeNow - issuedAt < 0) {
        console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew", issuedAt, expiresAt2, timeNow);
      }
      const { data, error } = await this._getUser(access_token);
      if (error)
        throw error;
      const session = {
        provider_token,
        provider_refresh_token,
        access_token,
        expires_in: expiresIn,
        expires_at: expiresAt2,
        refresh_token,
        token_type,
        user: data.user
      };
      window.location.hash = "";
      this._debug("#_getSessionFromURL()", "clearing window.location.hash");
      return this._returnResult({ data: { session, redirectType: params.type }, error: null });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { session: null, redirectType: null }, error });
      }
      throw error;
    }
  }
  /**
   * Checks if the current URL contains parameters given by an implicit oauth grant flow (https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2)
   *
   * If `detectSessionInUrl` is a function, it will be called with the URL and params to determine
   * if the URL should be processed as a Supabase auth callback. This allows users to exclude
   * URLs from other OAuth providers (e.g., Facebook Login) that also return access_token in the fragment.
   */
  _isImplicitGrantCallback(params) {
    if (typeof this.detectSessionInUrl === "function") {
      return this.detectSessionInUrl(new URL(window.location.href), params);
    }
    return Boolean(params.access_token || params.error_description);
  }
  /**
   * Checks if the current URL and backing storage contain parameters given by a PKCE flow
   */
  async _isPKCECallback(params) {
    const currentStorageContent = await getItemAsync(this.storage, `${this.storageKey}-code-verifier`);
    return !!(params.code && currentStorageContent);
  }
  /**
   * Inside a browser context, `signOut()` will remove the logged in user from the browser session and log them out - removing all items from localstorage and then trigger a `"SIGNED_OUT"` event.
   *
   * For server-side management, you can revoke all refresh tokens for a user by passing a user's JWT through to `auth.api.signOut(JWT: string)`.
   * There is no way to revoke a user's access token jwt until it expires. It is recommended to set a shorter expiry on the jwt for this reason.
   *
   * If using `others` scope, no `SIGNED_OUT` event is fired!
   */
  async signOut(options = { scope: "global" }) {
    await this.initializePromise;
    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._signOut(options);
    });
  }
  async _signOut({ scope } = { scope: "global" }) {
    return await this._useSession(async (result) => {
      var _a;
      const { data, error: sessionError } = result;
      if (sessionError && !isAuthSessionMissingError(sessionError)) {
        return this._returnResult({ error: sessionError });
      }
      const accessToken = (_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token;
      if (accessToken) {
        const { error } = await this.admin.signOut(accessToken, scope);
        if (error) {
          if (!(isAuthApiError(error) && (error.status === 404 || error.status === 401 || error.status === 403) || isAuthSessionMissingError(error))) {
            return this._returnResult({ error });
          }
        }
      }
      if (scope !== "others") {
        await this._removeSession();
        await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      }
      return this._returnResult({ error: null });
    });
  }
  onAuthStateChange(callback) {
    const id = generateCallbackId();
    const subscription = {
      id,
      callback,
      unsubscribe: /* @__PURE__ */ __name(() => {
        this._debug("#unsubscribe()", "state change callback with id removed", id);
        this.stateChangeEmitters.delete(id);
      }, "unsubscribe")
    };
    this._debug("#onAuthStateChange()", "registered callback with id", id);
    this.stateChangeEmitters.set(id, subscription);
    (async () => {
      await this.initializePromise;
      await this._acquireLock(this.lockAcquireTimeout, async () => {
        this._emitInitialSession(id);
      });
    })();
    return { data: { subscription } };
  }
  async _emitInitialSession(id) {
    return await this._useSession(async (result) => {
      var _a, _b;
      try {
        const { data: { session }, error } = result;
        if (error)
          throw error;
        await ((_a = this.stateChangeEmitters.get(id)) === null || _a === void 0 ? void 0 : _a.callback("INITIAL_SESSION", session));
        this._debug("INITIAL_SESSION", "callback id", id, "session", session);
      } catch (err) {
        await ((_b = this.stateChangeEmitters.get(id)) === null || _b === void 0 ? void 0 : _b.callback("INITIAL_SESSION", null));
        this._debug("INITIAL_SESSION", "callback id", id, "error", err);
        console.error(err);
      }
    });
  }
  /**
   * Sends a password reset request to an email address. This method supports the PKCE flow.
   *
   * @param email The email address of the user.
   * @param options.redirectTo The URL to send the user to after they click the password reset link.
   * @param options.captchaToken Verification token received when the user completes the captcha on the site.
   */
  async resetPasswordForEmail(email, options = {}) {
    let codeChallenge = null;
    let codeChallengeMethod = null;
    if (this.flowType === "pkce") {
      ;
      [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(
        this.storage,
        this.storageKey,
        true
        // isPasswordRecovery
      );
    }
    try {
      return await _request(this.fetch, "POST", `${this.url}/recover`, {
        body: {
          email,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          gotrue_meta_security: { captcha_token: options.captchaToken }
        },
        headers: this.headers,
        redirectTo: options.redirectTo
      });
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Gets all the identities linked to a user.
   */
  async getUserIdentities() {
    var _a;
    try {
      const { data, error } = await this.getUser();
      if (error)
        throw error;
      return this._returnResult({ data: { identities: (_a = data.user.identities) !== null && _a !== void 0 ? _a : [] }, error: null });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  async linkIdentity(credentials) {
    if ("token" in credentials) {
      return this.linkIdentityIdToken(credentials);
    }
    return this.linkIdentityOAuth(credentials);
  }
  async linkIdentityOAuth(credentials) {
    var _a;
    try {
      const { data, error } = await this._useSession(async (result) => {
        var _a2, _b, _c, _d, _e;
        const { data: data2, error: error2 } = result;
        if (error2)
          throw error2;
        const url = await this._getUrlForProvider(`${this.url}/user/identities/authorize`, credentials.provider, {
          redirectTo: (_a2 = credentials.options) === null || _a2 === void 0 ? void 0 : _a2.redirectTo,
          scopes: (_b = credentials.options) === null || _b === void 0 ? void 0 : _b.scopes,
          queryParams: (_c = credentials.options) === null || _c === void 0 ? void 0 : _c.queryParams,
          skipBrowserRedirect: true
        });
        return await _request(this.fetch, "GET", url, {
          headers: this.headers,
          jwt: (_e = (_d = data2.session) === null || _d === void 0 ? void 0 : _d.access_token) !== null && _e !== void 0 ? _e : void 0
        });
      });
      if (error)
        throw error;
      if (isBrowser() && !((_a = credentials.options) === null || _a === void 0 ? void 0 : _a.skipBrowserRedirect)) {
        window.location.assign(data === null || data === void 0 ? void 0 : data.url);
      }
      return this._returnResult({
        data: { provider: credentials.provider, url: data === null || data === void 0 ? void 0 : data.url },
        error: null
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { provider: credentials.provider, url: null }, error });
      }
      throw error;
    }
  }
  async linkIdentityIdToken(credentials) {
    return await this._useSession(async (result) => {
      var _a;
      try {
        const { error: sessionError, data: { session } } = result;
        if (sessionError)
          throw sessionError;
        const { options, provider, token, access_token, nonce } = credentials;
        const res = await _request(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
          headers: this.headers,
          jwt: (_a = session === null || session === void 0 ? void 0 : session.access_token) !== null && _a !== void 0 ? _a : void 0,
          body: {
            provider,
            id_token: token,
            access_token,
            nonce,
            link_identity: true,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
          },
          xform: _sessionResponse
        });
        const { data, error } = res;
        if (error) {
          return this._returnResult({ data: { user: null, session: null }, error });
        } else if (!data || !data.session || !data.user) {
          return this._returnResult({
            data: { user: null, session: null },
            error: new AuthInvalidTokenResponseError()
          });
        }
        if (data.session) {
          await this._saveSession(data.session);
          await this._notifyAllSubscribers("USER_UPDATED", data.session);
        }
        return this._returnResult({ data, error });
      } catch (error) {
        await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
        if (isAuthError(error)) {
          return this._returnResult({ data: { user: null, session: null }, error });
        }
        throw error;
      }
    });
  }
  /**
   * Unlinks an identity from a user by deleting it. The user will no longer be able to sign in with that identity once it's unlinked.
   */
  async unlinkIdentity(identity) {
    try {
      return await this._useSession(async (result) => {
        var _a, _b;
        const { data, error } = result;
        if (error) {
          throw error;
        }
        return await _request(this.fetch, "DELETE", `${this.url}/user/identities/${identity.identity_id}`, {
          headers: this.headers,
          jwt: (_b = (_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token) !== null && _b !== void 0 ? _b : void 0
        });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Generates a new JWT.
   * @param refreshToken A valid refresh token that was returned on login.
   */
  async _refreshAccessToken(refreshToken) {
    const debugName = `#_refreshAccessToken(${refreshToken.substring(0, 5)}...)`;
    this._debug(debugName, "begin");
    try {
      const startedAt = Date.now();
      return await retryable(async (attempt) => {
        if (attempt > 0) {
          await sleep(200 * Math.pow(2, attempt - 1));
        }
        this._debug(debugName, "refreshing attempt", attempt);
        return await _request(this.fetch, "POST", `${this.url}/token?grant_type=refresh_token`, {
          body: { refresh_token: refreshToken },
          headers: this.headers,
          xform: _sessionResponse
        });
      }, (attempt, error) => {
        const nextBackOffInterval = 200 * Math.pow(2, attempt);
        return error && isAuthRetryableFetchError(error) && // retryable only if the request can be sent before the backoff overflows the tick duration
        Date.now() + nextBackOffInterval - startedAt < AUTO_REFRESH_TICK_DURATION_MS;
      });
    } catch (error) {
      this._debug(debugName, "error", error);
      if (isAuthError(error)) {
        return this._returnResult({ data: { session: null, user: null }, error });
      }
      throw error;
    } finally {
      this._debug(debugName, "end");
    }
  }
  _isValidSession(maybeSession) {
    const isValidSession = typeof maybeSession === "object" && maybeSession !== null && "access_token" in maybeSession && "refresh_token" in maybeSession && "expires_at" in maybeSession;
    return isValidSession;
  }
  async _handleProviderSignIn(provider, options) {
    const url = await this._getUrlForProvider(`${this.url}/authorize`, provider, {
      redirectTo: options.redirectTo,
      scopes: options.scopes,
      queryParams: options.queryParams
    });
    this._debug("#_handleProviderSignIn()", "provider", provider, "options", options, "url", url);
    if (isBrowser() && !options.skipBrowserRedirect) {
      window.location.assign(url);
    }
    return { data: { provider, url }, error: null };
  }
  /**
   * Recovers the session from LocalStorage and refreshes the token
   * Note: this method is async to accommodate for AsyncStorage e.g. in React native.
   */
  async _recoverAndRefresh() {
    var _a, _b;
    const debugName = "#_recoverAndRefresh()";
    this._debug(debugName, "begin");
    try {
      const currentSession = await getItemAsync(this.storage, this.storageKey);
      if (currentSession && this.userStorage) {
        let maybeUser = await getItemAsync(this.userStorage, this.storageKey + "-user");
        if (!this.storage.isServer && Object.is(this.storage, this.userStorage) && !maybeUser) {
          maybeUser = { user: currentSession.user };
          await setItemAsync(this.userStorage, this.storageKey + "-user", maybeUser);
        }
        currentSession.user = (_a = maybeUser === null || maybeUser === void 0 ? void 0 : maybeUser.user) !== null && _a !== void 0 ? _a : userNotAvailableProxy();
      } else if (currentSession && !currentSession.user) {
        if (!currentSession.user) {
          const separateUser = await getItemAsync(this.storage, this.storageKey + "-user");
          if (separateUser && (separateUser === null || separateUser === void 0 ? void 0 : separateUser.user)) {
            currentSession.user = separateUser.user;
            await removeItemAsync(this.storage, this.storageKey + "-user");
            await setItemAsync(this.storage, this.storageKey, currentSession);
          } else {
            currentSession.user = userNotAvailableProxy();
          }
        }
      }
      this._debug(debugName, "session from storage", currentSession);
      if (!this._isValidSession(currentSession)) {
        this._debug(debugName, "session is not valid");
        if (currentSession !== null) {
          await this._removeSession();
        }
        return;
      }
      const expiresWithMargin = ((_b = currentSession.expires_at) !== null && _b !== void 0 ? _b : Infinity) * 1e3 - Date.now() < EXPIRY_MARGIN_MS;
      this._debug(debugName, `session has${expiresWithMargin ? "" : " not"} expired with margin of ${EXPIRY_MARGIN_MS}s`);
      if (expiresWithMargin) {
        if (this.autoRefreshToken && currentSession.refresh_token) {
          const { error } = await this._callRefreshToken(currentSession.refresh_token);
          if (error) {
            console.error(error);
            if (!isAuthRetryableFetchError(error)) {
              this._debug(debugName, "refresh failed with a non-retryable error, removing the session", error);
              await this._removeSession();
            }
          }
        }
      } else if (currentSession.user && currentSession.user.__isUserNotAvailableProxy === true) {
        try {
          const { data, error: userError } = await this._getUser(currentSession.access_token);
          if (!userError && (data === null || data === void 0 ? void 0 : data.user)) {
            currentSession.user = data.user;
            await this._saveSession(currentSession);
            await this._notifyAllSubscribers("SIGNED_IN", currentSession);
          } else {
            this._debug(debugName, "could not get user data, skipping SIGNED_IN notification");
          }
        } catch (getUserError) {
          console.error("Error getting user data:", getUserError);
          this._debug(debugName, "error getting user data, skipping SIGNED_IN notification", getUserError);
        }
      } else {
        await this._notifyAllSubscribers("SIGNED_IN", currentSession);
      }
    } catch (err) {
      this._debug(debugName, "error", err);
      console.error(err);
      return;
    } finally {
      this._debug(debugName, "end");
    }
  }
  async _callRefreshToken(refreshToken) {
    var _a, _b;
    if (!refreshToken) {
      throw new AuthSessionMissingError();
    }
    if (this.refreshingDeferred) {
      return this.refreshingDeferred.promise;
    }
    const debugName = `#_callRefreshToken(${refreshToken.substring(0, 5)}...)`;
    this._debug(debugName, "begin");
    try {
      this.refreshingDeferred = new Deferred();
      const { data, error } = await this._refreshAccessToken(refreshToken);
      if (error)
        throw error;
      if (!data.session)
        throw new AuthSessionMissingError();
      await this._saveSession(data.session);
      await this._notifyAllSubscribers("TOKEN_REFRESHED", data.session);
      const result = { data: data.session, error: null };
      this.refreshingDeferred.resolve(result);
      return result;
    } catch (error) {
      this._debug(debugName, "error", error);
      if (isAuthError(error)) {
        const result = { data: null, error };
        if (!isAuthRetryableFetchError(error)) {
          await this._removeSession();
        }
        (_a = this.refreshingDeferred) === null || _a === void 0 ? void 0 : _a.resolve(result);
        return result;
      }
      (_b = this.refreshingDeferred) === null || _b === void 0 ? void 0 : _b.reject(error);
      throw error;
    } finally {
      this.refreshingDeferred = null;
      this._debug(debugName, "end");
    }
  }
  async _notifyAllSubscribers(event, session, broadcast = true) {
    const debugName = `#_notifyAllSubscribers(${event})`;
    this._debug(debugName, "begin", session, `broadcast = ${broadcast}`);
    try {
      if (this.broadcastChannel && broadcast) {
        this.broadcastChannel.postMessage({ event, session });
      }
      const errors = [];
      const promises = Array.from(this.stateChangeEmitters.values()).map(async (x) => {
        try {
          await x.callback(event, session);
        } catch (e) {
          errors.push(e);
        }
      });
      await Promise.all(promises);
      if (errors.length > 0) {
        for (let i = 0; i < errors.length; i += 1) {
          console.error(errors[i]);
        }
        throw errors[0];
      }
    } finally {
      this._debug(debugName, "end");
    }
  }
  /**
   * set currentSession and currentUser
   * process to _startAutoRefreshToken if possible
   */
  async _saveSession(session) {
    this._debug("#_saveSession()", session);
    this.suppressGetSessionWarning = true;
    await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
    const sessionToProcess = Object.assign({}, session);
    const userIsProxy = sessionToProcess.user && sessionToProcess.user.__isUserNotAvailableProxy === true;
    if (this.userStorage) {
      if (!userIsProxy && sessionToProcess.user) {
        await setItemAsync(this.userStorage, this.storageKey + "-user", {
          user: sessionToProcess.user
        });
      } else if (userIsProxy) {
      }
      const mainSessionData = Object.assign({}, sessionToProcess);
      delete mainSessionData.user;
      const clonedMainSessionData = deepClone(mainSessionData);
      await setItemAsync(this.storage, this.storageKey, clonedMainSessionData);
    } else {
      const clonedSession = deepClone(sessionToProcess);
      await setItemAsync(this.storage, this.storageKey, clonedSession);
    }
  }
  async _removeSession() {
    this._debug("#_removeSession()");
    this.suppressGetSessionWarning = false;
    await removeItemAsync(this.storage, this.storageKey);
    await removeItemAsync(this.storage, this.storageKey + "-code-verifier");
    await removeItemAsync(this.storage, this.storageKey + "-user");
    if (this.userStorage) {
      await removeItemAsync(this.userStorage, this.storageKey + "-user");
    }
    await this._notifyAllSubscribers("SIGNED_OUT", null);
  }
  /**
   * Removes any registered visibilitychange callback.
   *
   * {@see #startAutoRefresh}
   * {@see #stopAutoRefresh}
   */
  _removeVisibilityChangedCallback() {
    this._debug("#_removeVisibilityChangedCallback()");
    const callback = this.visibilityChangedCallback;
    this.visibilityChangedCallback = null;
    try {
      if (callback && isBrowser() && (window === null || window === void 0 ? void 0 : window.removeEventListener)) {
        window.removeEventListener("visibilitychange", callback);
      }
    } catch (e) {
      console.error("removing visibilitychange callback failed", e);
    }
  }
  /**
   * This is the private implementation of {@link #startAutoRefresh}. Use this
   * within the library.
   */
  async _startAutoRefresh() {
    await this._stopAutoRefresh();
    this._debug("#_startAutoRefresh()");
    const ticker = setInterval(() => this._autoRefreshTokenTick(), AUTO_REFRESH_TICK_DURATION_MS);
    this.autoRefreshTicker = ticker;
    if (ticker && typeof ticker === "object" && typeof ticker.unref === "function") {
      ticker.unref();
    } else if (typeof Deno !== "undefined" && typeof Deno.unrefTimer === "function") {
      Deno.unrefTimer(ticker);
    }
    const timeout = setTimeout(async () => {
      await this.initializePromise;
      await this._autoRefreshTokenTick();
    }, 0);
    this.autoRefreshTickTimeout = timeout;
    if (timeout && typeof timeout === "object" && typeof timeout.unref === "function") {
      timeout.unref();
    } else if (typeof Deno !== "undefined" && typeof Deno.unrefTimer === "function") {
      Deno.unrefTimer(timeout);
    }
  }
  /**
   * This is the private implementation of {@link #stopAutoRefresh}. Use this
   * within the library.
   */
  async _stopAutoRefresh() {
    this._debug("#_stopAutoRefresh()");
    const ticker = this.autoRefreshTicker;
    this.autoRefreshTicker = null;
    if (ticker) {
      clearInterval(ticker);
    }
    const timeout = this.autoRefreshTickTimeout;
    this.autoRefreshTickTimeout = null;
    if (timeout) {
      clearTimeout(timeout);
    }
  }
  /**
   * Starts an auto-refresh process in the background. The session is checked
   * every few seconds. Close to the time of expiration a process is started to
   * refresh the session. If refreshing fails it will be retried for as long as
   * necessary.
   *
   * If you set the {@link GoTrueClientOptions#autoRefreshToken} you don't need
   * to call this function, it will be called for you.
   *
   * On browsers the refresh process works only when the tab/window is in the
   * foreground to conserve resources as well as prevent race conditions and
   * flooding auth with requests. If you call this method any managed
   * visibility change callback will be removed and you must manage visibility
   * changes on your own.
   *
   * On non-browser platforms the refresh process works *continuously* in the
   * background, which may not be desirable. You should hook into your
   * platform's foreground indication mechanism and call these methods
   * appropriately to conserve resources.
   *
   * {@see #stopAutoRefresh}
   */
  async startAutoRefresh() {
    this._removeVisibilityChangedCallback();
    await this._startAutoRefresh();
  }
  /**
   * Stops an active auto refresh process running in the background (if any).
   *
   * If you call this method any managed visibility change callback will be
   * removed and you must manage visibility changes on your own.
   *
   * See {@link #startAutoRefresh} for more details.
   */
  async stopAutoRefresh() {
    this._removeVisibilityChangedCallback();
    await this._stopAutoRefresh();
  }
  /**
   * Runs the auto refresh token tick.
   */
  async _autoRefreshTokenTick() {
    this._debug("#_autoRefreshTokenTick()", "begin");
    try {
      await this._acquireLock(0, async () => {
        try {
          const now = Date.now();
          try {
            return await this._useSession(async (result) => {
              const { data: { session } } = result;
              if (!session || !session.refresh_token || !session.expires_at) {
                this._debug("#_autoRefreshTokenTick()", "no session");
                return;
              }
              const expiresInTicks = Math.floor((session.expires_at * 1e3 - now) / AUTO_REFRESH_TICK_DURATION_MS);
              this._debug("#_autoRefreshTokenTick()", `access token expires in ${expiresInTicks} ticks, a tick lasts ${AUTO_REFRESH_TICK_DURATION_MS}ms, refresh threshold is ${AUTO_REFRESH_TICK_THRESHOLD} ticks`);
              if (expiresInTicks <= AUTO_REFRESH_TICK_THRESHOLD) {
                await this._callRefreshToken(session.refresh_token);
              }
            });
          } catch (e) {
            console.error("Auto refresh tick failed with error. This is likely a transient error.", e);
          }
        } finally {
          this._debug("#_autoRefreshTokenTick()", "end");
        }
      });
    } catch (e) {
      if (e.isAcquireTimeout || e instanceof LockAcquireTimeoutError) {
        this._debug("auto refresh token tick lock not available");
      } else {
        throw e;
      }
    }
  }
  /**
   * Registers callbacks on the browser / platform, which in-turn run
   * algorithms when the browser window/tab are in foreground. On non-browser
   * platforms it assumes always foreground.
   */
  async _handleVisibilityChange() {
    this._debug("#_handleVisibilityChange()");
    if (!isBrowser() || !(window === null || window === void 0 ? void 0 : window.addEventListener)) {
      if (this.autoRefreshToken) {
        this.startAutoRefresh();
      }
      return false;
    }
    try {
      this.visibilityChangedCallback = async () => {
        try {
          await this._onVisibilityChanged(false);
        } catch (error) {
          this._debug("#visibilityChangedCallback", "error", error);
        }
      };
      window === null || window === void 0 ? void 0 : window.addEventListener("visibilitychange", this.visibilityChangedCallback);
      await this._onVisibilityChanged(true);
    } catch (error) {
      console.error("_handleVisibilityChange", error);
    }
  }
  /**
   * Callback registered with `window.addEventListener('visibilitychange')`.
   */
  async _onVisibilityChanged(calledFromInitialize) {
    const methodName = `#_onVisibilityChanged(${calledFromInitialize})`;
    this._debug(methodName, "visibilityState", document.visibilityState);
    if (document.visibilityState === "visible") {
      if (this.autoRefreshToken) {
        this._startAutoRefresh();
      }
      if (!calledFromInitialize) {
        await this.initializePromise;
        await this._acquireLock(this.lockAcquireTimeout, async () => {
          if (document.visibilityState !== "visible") {
            this._debug(methodName, "acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting");
            return;
          }
          await this._recoverAndRefresh();
        });
      }
    } else if (document.visibilityState === "hidden") {
      if (this.autoRefreshToken) {
        this._stopAutoRefresh();
      }
    }
  }
  /**
   * Generates the relevant login URL for a third-party provider.
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param options.scopes A space-separated list of scopes granted to the OAuth application.
   * @param options.queryParams An object of key-value pairs containing query parameters granted to the OAuth application.
   */
  async _getUrlForProvider(url, provider, options) {
    const urlParams = [`provider=${encodeURIComponent(provider)}`];
    if (options === null || options === void 0 ? void 0 : options.redirectTo) {
      urlParams.push(`redirect_to=${encodeURIComponent(options.redirectTo)}`);
    }
    if (options === null || options === void 0 ? void 0 : options.scopes) {
      urlParams.push(`scopes=${encodeURIComponent(options.scopes)}`);
    }
    if (this.flowType === "pkce") {
      const [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(this.storage, this.storageKey);
      const flowParams = new URLSearchParams({
        code_challenge: `${encodeURIComponent(codeChallenge)}`,
        code_challenge_method: `${encodeURIComponent(codeChallengeMethod)}`
      });
      urlParams.push(flowParams.toString());
    }
    if (options === null || options === void 0 ? void 0 : options.queryParams) {
      const query = new URLSearchParams(options.queryParams);
      urlParams.push(query.toString());
    }
    if (options === null || options === void 0 ? void 0 : options.skipBrowserRedirect) {
      urlParams.push(`skip_http_redirect=${options.skipBrowserRedirect}`);
    }
    return `${url}?${urlParams.join("&")}`;
  }
  async _unenroll(params) {
    try {
      return await this._useSession(async (result) => {
        var _a;
        const { data: sessionData, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        return await _request(this.fetch, "DELETE", `${this.url}/factors/${params.factorId}`, {
          headers: this.headers,
          jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
        });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  async _enroll(params) {
    try {
      return await this._useSession(async (result) => {
        var _a, _b;
        const { data: sessionData, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        const body = Object.assign({ friendly_name: params.friendlyName, factor_type: params.factorType }, params.factorType === "phone" ? { phone: params.phone } : params.factorType === "totp" ? { issuer: params.issuer } : {});
        const { data, error } = await _request(this.fetch, "POST", `${this.url}/factors`, {
          body,
          headers: this.headers,
          jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
        });
        if (error) {
          return this._returnResult({ data: null, error });
        }
        if (params.factorType === "totp" && data.type === "totp" && ((_b = data === null || data === void 0 ? void 0 : data.totp) === null || _b === void 0 ? void 0 : _b.qr_code)) {
          data.totp.qr_code = `data:image/svg+xml;utf-8,${data.totp.qr_code}`;
        }
        return this._returnResult({ data, error: null });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  async _verify(params) {
    return this._acquireLock(this.lockAcquireTimeout, async () => {
      try {
        return await this._useSession(async (result) => {
          var _a;
          const { data: sessionData, error: sessionError } = result;
          if (sessionError) {
            return this._returnResult({ data: null, error: sessionError });
          }
          const body = Object.assign({ challenge_id: params.challengeId }, "webauthn" in params ? {
            webauthn: Object.assign(Object.assign({}, params.webauthn), { credential_response: params.webauthn.type === "create" ? serializeCredentialCreationResponse(params.webauthn.credential_response) : serializeCredentialRequestResponse(params.webauthn.credential_response) })
          } : { code: params.code });
          const { data, error } = await _request(this.fetch, "POST", `${this.url}/factors/${params.factorId}/verify`, {
            body,
            headers: this.headers,
            jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
          });
          if (error) {
            return this._returnResult({ data: null, error });
          }
          await this._saveSession(Object.assign({ expires_at: Math.round(Date.now() / 1e3) + data.expires_in }, data));
          await this._notifyAllSubscribers("MFA_CHALLENGE_VERIFIED", data);
          return this._returnResult({ data, error });
        });
      } catch (error) {
        if (isAuthError(error)) {
          return this._returnResult({ data: null, error });
        }
        throw error;
      }
    });
  }
  async _challenge(params) {
    return this._acquireLock(this.lockAcquireTimeout, async () => {
      try {
        return await this._useSession(async (result) => {
          var _a;
          const { data: sessionData, error: sessionError } = result;
          if (sessionError) {
            return this._returnResult({ data: null, error: sessionError });
          }
          const response = await _request(this.fetch, "POST", `${this.url}/factors/${params.factorId}/challenge`, {
            body: params,
            headers: this.headers,
            jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
          });
          if (response.error) {
            return response;
          }
          const { data } = response;
          if (data.type !== "webauthn") {
            return { data, error: null };
          }
          switch (data.webauthn.type) {
            case "create":
              return {
                data: Object.assign(Object.assign({}, data), { webauthn: Object.assign(Object.assign({}, data.webauthn), { credential_options: Object.assign(Object.assign({}, data.webauthn.credential_options), { publicKey: deserializeCredentialCreationOptions(data.webauthn.credential_options.publicKey) }) }) }),
                error: null
              };
            case "request":
              return {
                data: Object.assign(Object.assign({}, data), { webauthn: Object.assign(Object.assign({}, data.webauthn), { credential_options: Object.assign(Object.assign({}, data.webauthn.credential_options), { publicKey: deserializeCredentialRequestOptions(data.webauthn.credential_options.publicKey) }) }) }),
                error: null
              };
          }
        });
      } catch (error) {
        if (isAuthError(error)) {
          return this._returnResult({ data: null, error });
        }
        throw error;
      }
    });
  }
  /**
   * {@see GoTrueMFAApi#challengeAndVerify}
   */
  async _challengeAndVerify(params) {
    const { data: challengeData, error: challengeError } = await this._challenge({
      factorId: params.factorId
    });
    if (challengeError) {
      return this._returnResult({ data: null, error: challengeError });
    }
    return await this._verify({
      factorId: params.factorId,
      challengeId: challengeData.id,
      code: params.code
    });
  }
  /**
   * {@see GoTrueMFAApi#listFactors}
   */
  async _listFactors() {
    var _a;
    const { data: { user }, error: userError } = await this.getUser();
    if (userError) {
      return { data: null, error: userError };
    }
    const data = {
      all: [],
      phone: [],
      totp: [],
      webauthn: []
    };
    for (const factor of (_a = user === null || user === void 0 ? void 0 : user.factors) !== null && _a !== void 0 ? _a : []) {
      data.all.push(factor);
      if (factor.status === "verified") {
        ;
        data[factor.factor_type].push(factor);
      }
    }
    return {
      data,
      error: null
    };
  }
  /**
   * {@see GoTrueMFAApi#getAuthenticatorAssuranceLevel}
   */
  async _getAuthenticatorAssuranceLevel(jwt) {
    var _a, _b, _c, _d;
    if (jwt) {
      try {
        const { payload: payload2 } = decodeJWT(jwt);
        let currentLevel2 = null;
        if (payload2.aal) {
          currentLevel2 = payload2.aal;
        }
        let nextLevel2 = currentLevel2;
        const { data: { user }, error: userError } = await this.getUser(jwt);
        if (userError) {
          return this._returnResult({ data: null, error: userError });
        }
        const verifiedFactors2 = (_b = (_a = user === null || user === void 0 ? void 0 : user.factors) === null || _a === void 0 ? void 0 : _a.filter((factor) => factor.status === "verified")) !== null && _b !== void 0 ? _b : [];
        if (verifiedFactors2.length > 0) {
          nextLevel2 = "aal2";
        }
        const currentAuthenticationMethods2 = payload2.amr || [];
        return { data: { currentLevel: currentLevel2, nextLevel: nextLevel2, currentAuthenticationMethods: currentAuthenticationMethods2 }, error: null };
      } catch (error) {
        if (isAuthError(error)) {
          return this._returnResult({ data: null, error });
        }
        throw error;
      }
    }
    const { data: { session }, error: sessionError } = await this.getSession();
    if (sessionError) {
      return this._returnResult({ data: null, error: sessionError });
    }
    if (!session) {
      return {
        data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] },
        error: null
      };
    }
    const { payload } = decodeJWT(session.access_token);
    let currentLevel = null;
    if (payload.aal) {
      currentLevel = payload.aal;
    }
    let nextLevel = currentLevel;
    const verifiedFactors = (_d = (_c = session.user.factors) === null || _c === void 0 ? void 0 : _c.filter((factor) => factor.status === "verified")) !== null && _d !== void 0 ? _d : [];
    if (verifiedFactors.length > 0) {
      nextLevel = "aal2";
    }
    const currentAuthenticationMethods = payload.amr || [];
    return { data: { currentLevel, nextLevel, currentAuthenticationMethods }, error: null };
  }
  /**
   * Retrieves details about an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * Returns authorization details including client info, scopes, and user information.
   * If the response includes only a redirect_url field, it means consent was already given - the caller
   * should handle the redirect manually if needed.
   */
  async _getAuthorizationDetails(authorizationId) {
    try {
      return await this._useSession(async (result) => {
        const { data: { session }, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() });
        }
        return await _request(this.fetch, "GET", `${this.url}/oauth/authorizations/${authorizationId}`, {
          headers: this.headers,
          jwt: session.access_token,
          xform: /* @__PURE__ */ __name((data) => ({ data, error: null }), "xform")
        });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Approves an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _approveAuthorization(authorizationId, options) {
    try {
      return await this._useSession(async (result) => {
        const { data: { session }, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() });
        }
        const response = await _request(this.fetch, "POST", `${this.url}/oauth/authorizations/${authorizationId}/consent`, {
          headers: this.headers,
          jwt: session.access_token,
          body: { action: "approve" },
          xform: /* @__PURE__ */ __name((data) => ({ data, error: null }), "xform")
        });
        if (response.data && response.data.redirect_url) {
          if (isBrowser() && !(options === null || options === void 0 ? void 0 : options.skipBrowserRedirect)) {
            window.location.assign(response.data.redirect_url);
          }
        }
        return response;
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Denies an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _denyAuthorization(authorizationId, options) {
    try {
      return await this._useSession(async (result) => {
        const { data: { session }, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() });
        }
        const response = await _request(this.fetch, "POST", `${this.url}/oauth/authorizations/${authorizationId}/consent`, {
          headers: this.headers,
          jwt: session.access_token,
          body: { action: "deny" },
          xform: /* @__PURE__ */ __name((data) => ({ data, error: null }), "xform")
        });
        if (response.data && response.data.redirect_url) {
          if (isBrowser() && !(options === null || options === void 0 ? void 0 : options.skipBrowserRedirect)) {
            window.location.assign(response.data.redirect_url);
          }
        }
        return response;
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Lists all OAuth grants that the authenticated user has authorized.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _listOAuthGrants() {
    try {
      return await this._useSession(async (result) => {
        const { data: { session }, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() });
        }
        return await _request(this.fetch, "GET", `${this.url}/user/oauth/grants`, {
          headers: this.headers,
          jwt: session.access_token,
          xform: /* @__PURE__ */ __name((data) => ({ data, error: null }), "xform")
        });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Revokes a user's OAuth grant for a specific client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _revokeOAuthGrant(options) {
    try {
      return await this._useSession(async (result) => {
        const { data: { session }, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() });
        }
        await _request(this.fetch, "DELETE", `${this.url}/user/oauth/grants`, {
          headers: this.headers,
          jwt: session.access_token,
          query: { client_id: options.clientId },
          noResolveJson: true
        });
        return { data: {}, error: null };
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  async fetchJwk(kid, jwks = { keys: [] }) {
    let jwk = jwks.keys.find((key) => key.kid === kid);
    if (jwk) {
      return jwk;
    }
    const now = Date.now();
    jwk = this.jwks.keys.find((key) => key.kid === kid);
    if (jwk && this.jwks_cached_at + JWKS_TTL > now) {
      return jwk;
    }
    const { data, error } = await _request(this.fetch, "GET", `${this.url}/.well-known/jwks.json`, {
      headers: this.headers
    });
    if (error) {
      throw error;
    }
    if (!data.keys || data.keys.length === 0) {
      return null;
    }
    this.jwks = data;
    this.jwks_cached_at = now;
    jwk = data.keys.find((key) => key.kid === kid);
    if (!jwk) {
      return null;
    }
    return jwk;
  }
  /**
   * Extracts the JWT claims present in the access token by first verifying the
   * JWT against the server's JSON Web Key Set endpoint
   * `/.well-known/jwks.json` which is often cached, resulting in significantly
   * faster responses. Prefer this method over {@link #getUser} which always
   * sends a request to the Auth server for each JWT.
   *
   * If the project is not using an asymmetric JWT signing key (like ECC or
   * RSA) it always sends a request to the Auth server (similar to {@link
   * #getUser}) to verify the JWT.
   *
   * @param jwt An optional specific JWT you wish to verify, not the one you
   *            can obtain from {@link #getSession}.
   * @param options Various additional options that allow you to customize the
   *                behavior of this method.
   */
  async getClaims(jwt, options = {}) {
    try {
      let token = jwt;
      if (!token) {
        const { data, error } = await this.getSession();
        if (error || !data.session) {
          return this._returnResult({ data: null, error });
        }
        token = data.session.access_token;
      }
      const { header, payload, signature, raw: { header: rawHeader, payload: rawPayload } } = decodeJWT(token);
      if (!(options === null || options === void 0 ? void 0 : options.allowExpired)) {
        validateExp(payload.exp);
      }
      const signingKey = !header.alg || header.alg.startsWith("HS") || !header.kid || !("crypto" in globalThis && "subtle" in globalThis.crypto) ? null : await this.fetchJwk(header.kid, (options === null || options === void 0 ? void 0 : options.keys) ? { keys: options.keys } : options === null || options === void 0 ? void 0 : options.jwks);
      if (!signingKey) {
        const { error } = await this.getUser(token);
        if (error) {
          throw error;
        }
        return {
          data: {
            claims: payload,
            header,
            signature
          },
          error: null
        };
      }
      const algorithm = getAlgorithm(header.alg);
      const publicKey = await crypto.subtle.importKey("jwk", signingKey, algorithm, true, [
        "verify"
      ]);
      const isValid = await crypto.subtle.verify(algorithm, publicKey, signature, stringToUint8Array(`${rawHeader}.${rawPayload}`));
      if (!isValid) {
        throw new AuthInvalidJwtError("Invalid JWT signature");
      }
      return {
        data: {
          claims: payload,
          header,
          signature
        },
        error: null
      };
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
};
GoTrueClient.nextInstanceID = {};
var GoTrueClient_default = GoTrueClient;

// node_modules/@supabase/auth-js/dist/module/AuthClient.js
var AuthClient = GoTrueClient_default;
var AuthClient_default = AuthClient;

// node_modules/@supabase/supabase-js/dist/index.mjs
var version4 = "2.97.0";
var JS_ENV = "";
if (typeof Deno !== "undefined") JS_ENV = "deno";
else if (typeof document !== "undefined") JS_ENV = "web";
else if (typeof navigator !== "undefined" && navigator.product === "ReactNative") JS_ENV = "react-native";
else JS_ENV = "node";
var DEFAULT_HEADERS3 = { "X-Client-Info": `supabase-js-${JS_ENV}/${version4}` };
var DEFAULT_GLOBAL_OPTIONS = { headers: DEFAULT_HEADERS3 };
var DEFAULT_DB_OPTIONS = { schema: "public" };
var DEFAULT_AUTH_OPTIONS = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: "implicit"
};
var DEFAULT_REALTIME_OPTIONS = {};
function _typeof3(o) {
  "@babel/helpers - typeof";
  return _typeof3 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
    return typeof o$1;
  } : function(o$1) {
    return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
  }, _typeof3(o);
}
__name(_typeof3, "_typeof");
function toPrimitive3(t, r) {
  if ("object" != _typeof3(t) || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != _typeof3(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
__name(toPrimitive3, "toPrimitive");
function toPropertyKey3(t) {
  var i = toPrimitive3(t, "string");
  return "symbol" == _typeof3(i) ? i : i + "";
}
__name(toPropertyKey3, "toPropertyKey");
function _defineProperty3(e, r, t) {
  return (r = toPropertyKey3(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
__name(_defineProperty3, "_defineProperty");
function ownKeys3(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r$1) {
      return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
__name(ownKeys3, "ownKeys");
function _objectSpread23(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys3(Object(t), true).forEach(function(r$1) {
      _defineProperty3(e, r$1, t[r$1]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys3(Object(t)).forEach(function(r$1) {
      Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t, r$1));
    });
  }
  return e;
}
__name(_objectSpread23, "_objectSpread2");
var resolveFetch4 = /* @__PURE__ */ __name((customFetch) => {
  if (customFetch) return (...args) => customFetch(...args);
  return (...args) => fetch(...args);
}, "resolveFetch");
var resolveHeadersConstructor = /* @__PURE__ */ __name(() => {
  return Headers;
}, "resolveHeadersConstructor");
var fetchWithAuth = /* @__PURE__ */ __name((supabaseKey, getAccessToken, customFetch) => {
  const fetch$1 = resolveFetch4(customFetch);
  const HeadersConstructor = resolveHeadersConstructor();
  return async (input, init) => {
    var _await$getAccessToken;
    const accessToken = (_await$getAccessToken = await getAccessToken()) !== null && _await$getAccessToken !== void 0 ? _await$getAccessToken : supabaseKey;
    let headers = new HeadersConstructor(init === null || init === void 0 ? void 0 : init.headers);
    if (!headers.has("apikey")) headers.set("apikey", supabaseKey);
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch$1(input, _objectSpread23(_objectSpread23({}, init), {}, { headers }));
  };
}, "fetchWithAuth");
function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : url + "/";
}
__name(ensureTrailingSlash, "ensureTrailingSlash");
function applySettingDefaults(options, defaults) {
  var _DEFAULT_GLOBAL_OPTIO, _globalOptions$header;
  const { db: dbOptions, auth: authOptions, realtime: realtimeOptions, global: globalOptions } = options;
  const { db: DEFAULT_DB_OPTIONS$1, auth: DEFAULT_AUTH_OPTIONS$1, realtime: DEFAULT_REALTIME_OPTIONS$1, global: DEFAULT_GLOBAL_OPTIONS$1 } = defaults;
  const result = {
    db: _objectSpread23(_objectSpread23({}, DEFAULT_DB_OPTIONS$1), dbOptions),
    auth: _objectSpread23(_objectSpread23({}, DEFAULT_AUTH_OPTIONS$1), authOptions),
    realtime: _objectSpread23(_objectSpread23({}, DEFAULT_REALTIME_OPTIONS$1), realtimeOptions),
    storage: {},
    global: _objectSpread23(_objectSpread23(_objectSpread23({}, DEFAULT_GLOBAL_OPTIONS$1), globalOptions), {}, { headers: _objectSpread23(_objectSpread23({}, (_DEFAULT_GLOBAL_OPTIO = DEFAULT_GLOBAL_OPTIONS$1 === null || DEFAULT_GLOBAL_OPTIONS$1 === void 0 ? void 0 : DEFAULT_GLOBAL_OPTIONS$1.headers) !== null && _DEFAULT_GLOBAL_OPTIO !== void 0 ? _DEFAULT_GLOBAL_OPTIO : {}), (_globalOptions$header = globalOptions === null || globalOptions === void 0 ? void 0 : globalOptions.headers) !== null && _globalOptions$header !== void 0 ? _globalOptions$header : {}) }),
    accessToken: /* @__PURE__ */ __name(async () => "", "accessToken")
  };
  if (options.accessToken) result.accessToken = options.accessToken;
  else delete result.accessToken;
  return result;
}
__name(applySettingDefaults, "applySettingDefaults");
function validateSupabaseUrl(supabaseUrl) {
  const trimmedUrl = supabaseUrl === null || supabaseUrl === void 0 ? void 0 : supabaseUrl.trim();
  if (!trimmedUrl) throw new Error("supabaseUrl is required.");
  if (!trimmedUrl.match(/^https?:\/\//i)) throw new Error("Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.");
  try {
    return new URL(ensureTrailingSlash(trimmedUrl));
  } catch (_unused) {
    throw Error("Invalid supabaseUrl: Provided URL is malformed.");
  }
}
__name(validateSupabaseUrl, "validateSupabaseUrl");
var SupabaseAuthClient = class extends AuthClient_default {
  static {
    __name(this, "SupabaseAuthClient");
  }
  constructor(options) {
    super(options);
  }
};
var SupabaseClient = class {
  static {
    __name(this, "SupabaseClient");
  }
  /**
  * Create a new client for use in the browser.
  * @param supabaseUrl The unique Supabase URL which is supplied when you create a new project in your project dashboard.
  * @param supabaseKey The unique Supabase Key which is supplied when you create a new project in your project dashboard.
  * @param options.db.schema You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
  * @param options.auth.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
  * @param options.auth.persistSession Set to "true" if you want to automatically save the user session into local storage.
  * @param options.auth.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
  * @param options.realtime Options passed along to realtime-js constructor.
  * @param options.storage Options passed along to the storage-js constructor.
  * @param options.global.fetch A custom fetch implementation.
  * @param options.global.headers Any additional headers to send with each network request.
  * @example
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')
  * const { data } = await supabase.from('profiles').select('*')
  * ```
  */
  constructor(supabaseUrl, supabaseKey, options) {
    var _settings$auth$storag, _settings$global$head;
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
    const baseUrl = validateSupabaseUrl(supabaseUrl);
    if (!supabaseKey) throw new Error("supabaseKey is required.");
    this.realtimeUrl = new URL("realtime/v1", baseUrl);
    this.realtimeUrl.protocol = this.realtimeUrl.protocol.replace("http", "ws");
    this.authUrl = new URL("auth/v1", baseUrl);
    this.storageUrl = new URL("storage/v1", baseUrl);
    this.functionsUrl = new URL("functions/v1", baseUrl);
    const defaultStorageKey = `sb-${baseUrl.hostname.split(".")[0]}-auth-token`;
    const DEFAULTS = {
      db: DEFAULT_DB_OPTIONS,
      realtime: DEFAULT_REALTIME_OPTIONS,
      auth: _objectSpread23(_objectSpread23({}, DEFAULT_AUTH_OPTIONS), {}, { storageKey: defaultStorageKey }),
      global: DEFAULT_GLOBAL_OPTIONS
    };
    const settings = applySettingDefaults(options !== null && options !== void 0 ? options : {}, DEFAULTS);
    this.storageKey = (_settings$auth$storag = settings.auth.storageKey) !== null && _settings$auth$storag !== void 0 ? _settings$auth$storag : "";
    this.headers = (_settings$global$head = settings.global.headers) !== null && _settings$global$head !== void 0 ? _settings$global$head : {};
    if (!settings.accessToken) {
      var _settings$auth;
      this.auth = this._initSupabaseAuthClient((_settings$auth = settings.auth) !== null && _settings$auth !== void 0 ? _settings$auth : {}, this.headers, settings.global.fetch);
    } else {
      this.accessToken = settings.accessToken;
      this.auth = new Proxy({}, { get: /* @__PURE__ */ __name((_, prop) => {
        throw new Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(prop)} is not possible`);
      }, "get") });
    }
    this.fetch = fetchWithAuth(supabaseKey, this._getAccessToken.bind(this), settings.global.fetch);
    this.realtime = this._initRealtimeClient(_objectSpread23({
      headers: this.headers,
      accessToken: this._getAccessToken.bind(this)
    }, settings.realtime));
    if (this.accessToken) Promise.resolve(this.accessToken()).then((token) => this.realtime.setAuth(token)).catch((e) => console.warn("Failed to set initial Realtime auth token:", e));
    this.rest = new PostgrestClient(new URL("rest/v1", baseUrl).href, {
      headers: this.headers,
      schema: settings.db.schema,
      fetch: this.fetch,
      timeout: settings.db.timeout,
      urlLengthLimit: settings.db.urlLengthLimit
    });
    this.storage = new StorageClient(this.storageUrl.href, this.headers, this.fetch, options === null || options === void 0 ? void 0 : options.storage);
    if (!settings.accessToken) this._listenForAuthEvents();
  }
  /**
  * Supabase Functions allows you to deploy and invoke edge functions.
  */
  get functions() {
    return new FunctionsClient(this.functionsUrl.href, {
      headers: this.headers,
      customFetch: this.fetch
    });
  }
  /**
  * Perform a query on a table or a view.
  *
  * @param relation - The table or view name to query
  */
  from(relation) {
    return this.rest.from(relation);
  }
  /**
  * Select a schema to query or perform an function (rpc) call.
  *
  * The schema needs to be on the list of exposed schemas inside Supabase.
  *
  * @param schema - The schema to query
  */
  schema(schema) {
    return this.rest.schema(schema);
  }
  /**
  * Perform a function call.
  *
  * @param fn - The function name to call
  * @param args - The arguments to pass to the function call
  * @param options - Named parameters
  * @param options.head - When set to `true`, `data` will not be returned.
  * Useful if you only need the count.
  * @param options.get - When set to `true`, the function will be called with
  * read-only access mode.
  * @param options.count - Count algorithm to use to count rows returned by the
  * function. Only applicable for [set-returning
  * functions](https://www.postgresql.org/docs/current/functions-srf.html).
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  */
  rpc(fn, args = {}, options = {
    head: false,
    get: false,
    count: void 0
  }) {
    return this.rest.rpc(fn, args, options);
  }
  /**
  * Creates a Realtime channel with Broadcast, Presence, and Postgres Changes.
  *
  * @param {string} name - The name of the Realtime channel.
  * @param {Object} opts - The options to pass to the Realtime channel.
  *
  */
  channel(name, opts = { config: {} }) {
    return this.realtime.channel(name, opts);
  }
  /**
  * Returns all Realtime channels.
  */
  getChannels() {
    return this.realtime.getChannels();
  }
  /**
  * Unsubscribes and removes Realtime channel from Realtime client.
  *
  * @param {RealtimeChannel} channel - The name of the Realtime channel.
  *
  */
  removeChannel(channel) {
    return this.realtime.removeChannel(channel);
  }
  /**
  * Unsubscribes and removes all Realtime channels from Realtime client.
  */
  removeAllChannels() {
    return this.realtime.removeAllChannels();
  }
  async _getAccessToken() {
    var _this = this;
    var _data$session$access_, _data$session;
    if (_this.accessToken) return await _this.accessToken();
    const { data } = await _this.auth.getSession();
    return (_data$session$access_ = (_data$session = data.session) === null || _data$session === void 0 ? void 0 : _data$session.access_token) !== null && _data$session$access_ !== void 0 ? _data$session$access_ : _this.supabaseKey;
  }
  _initSupabaseAuthClient({ autoRefreshToken, persistSession, detectSessionInUrl, storage, userStorage, storageKey, flowType, lock, debug, throwOnError }, headers, fetch$1) {
    const authHeaders = {
      Authorization: `Bearer ${this.supabaseKey}`,
      apikey: `${this.supabaseKey}`
    };
    return new SupabaseAuthClient({
      url: this.authUrl.href,
      headers: _objectSpread23(_objectSpread23({}, authHeaders), headers),
      storageKey,
      autoRefreshToken,
      persistSession,
      detectSessionInUrl,
      storage,
      userStorage,
      flowType,
      lock,
      debug,
      throwOnError,
      fetch: fetch$1,
      hasCustomAuthorizationHeader: Object.keys(this.headers).some((key) => key.toLowerCase() === "authorization")
    });
  }
  _initRealtimeClient(options) {
    return new RealtimeClient(this.realtimeUrl.href, _objectSpread23(_objectSpread23({}, options), {}, { params: _objectSpread23(_objectSpread23({}, { apikey: this.supabaseKey }), options === null || options === void 0 ? void 0 : options.params) }));
  }
  _listenForAuthEvents() {
    return this.auth.onAuthStateChange((event, session) => {
      this._handleTokenChanged(event, "CLIENT", session === null || session === void 0 ? void 0 : session.access_token);
    });
  }
  _handleTokenChanged(event, source, token) {
    if ((event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && this.changedAccessToken !== token) {
      this.changedAccessToken = token;
      this.realtime.setAuth(token);
    } else if (event === "SIGNED_OUT") {
      this.realtime.setAuth();
      if (source == "STORAGE") this.auth.signOut();
      this.changedAccessToken = void 0;
    }
  }
};
var createClient = /* @__PURE__ */ __name((supabaseUrl, supabaseKey, options) => {
  return new SupabaseClient(supabaseUrl, supabaseKey, options);
}, "createClient");
function shouldShowDeprecationWarning() {
  if (typeof window !== "undefined") return false;
  const _process = globalThis["process"];
  if (!_process) return false;
  const processVersion = _process["version"];
  if (processVersion === void 0 || processVersion === null) return false;
  const versionMatch = processVersion.match(/^v(\d+)\./);
  if (!versionMatch) return false;
  return parseInt(versionMatch[1], 10) <= 18;
}
__name(shouldShowDeprecationWarning, "shouldShowDeprecationWarning");
if (shouldShowDeprecationWarning()) console.warn("\u26A0\uFE0F  Node.js 18 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 20 or later. For more information, visit: https://github.com/orgs/supabase/discussions/37217");

// node_modules/jose/dist/webapi/lib/buffer_utils.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var MAX_INT32 = 2 ** 32;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0);
  const buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers) {
    buf.set(buffer, i);
    i += buffer.length;
  }
  return buf;
}
__name(concat, "concat");
function encode(string) {
  const bytes = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code > 127) {
      throw new TypeError("non-ASCII string encountered in encode()");
    }
    bytes[i] = code;
  }
  return bytes;
}
__name(encode, "encode");

// node_modules/jose/dist/webapi/lib/base64.js
function encodeBase64(input) {
  if (Uint8Array.prototype.toBase64) {
    return input.toBase64();
  }
  const CHUNK_SIZE = 32768;
  const arr = [];
  for (let i = 0; i < input.length; i += CHUNK_SIZE) {
    arr.push(String.fromCharCode.apply(null, input.subarray(i, i + CHUNK_SIZE)));
  }
  return btoa(arr.join(""));
}
__name(encodeBase64, "encodeBase64");
function decodeBase64(encoded) {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(encoded);
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(decodeBase64, "decodeBase64");

// node_modules/jose/dist/webapi/util/base64url.js
function decode(input) {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(typeof input === "string" ? input : decoder.decode(input), {
      alphabet: "base64url"
    });
  }
  let encoded = input;
  if (encoded instanceof Uint8Array) {
    encoded = decoder.decode(encoded);
  }
  encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeBase64(encoded);
  } catch {
    throw new TypeError("The input to be decoded is not correctly encoded.");
  }
}
__name(decode, "decode");
function encode2(input) {
  let unencoded = input;
  if (typeof unencoded === "string") {
    unencoded = encoder.encode(unencoded);
  }
  if (Uint8Array.prototype.toBase64) {
    return unencoded.toBase64({ alphabet: "base64url", omitPadding: true });
  }
  return encodeBase64(unencoded).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
__name(encode2, "encode");

// node_modules/jose/dist/webapi/util/errors.js
var JOSEError = class extends Error {
  static {
    __name(this, "JOSEError");
  }
  static code = "ERR_JOSE_GENERIC";
  code = "ERR_JOSE_GENERIC";
  constructor(message2, options) {
    super(message2, options);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
};
var JWTClaimValidationFailed = class extends JOSEError {
  static {
    __name(this, "JWTClaimValidationFailed");
  }
  static code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
var JWTExpired = class extends JOSEError {
  static {
    __name(this, "JWTExpired");
  }
  static code = "ERR_JWT_EXPIRED";
  code = "ERR_JWT_EXPIRED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
var JOSEAlgNotAllowed = class extends JOSEError {
  static {
    __name(this, "JOSEAlgNotAllowed");
  }
  static code = "ERR_JOSE_ALG_NOT_ALLOWED";
  code = "ERR_JOSE_ALG_NOT_ALLOWED";
};
var JOSENotSupported = class extends JOSEError {
  static {
    __name(this, "JOSENotSupported");
  }
  static code = "ERR_JOSE_NOT_SUPPORTED";
  code = "ERR_JOSE_NOT_SUPPORTED";
};
var JWSInvalid = class extends JOSEError {
  static {
    __name(this, "JWSInvalid");
  }
  static code = "ERR_JWS_INVALID";
  code = "ERR_JWS_INVALID";
};
var JWTInvalid = class extends JOSEError {
  static {
    __name(this, "JWTInvalid");
  }
  static code = "ERR_JWT_INVALID";
  code = "ERR_JWT_INVALID";
};
var JWSSignatureVerificationFailed = class extends JOSEError {
  static {
    __name(this, "JWSSignatureVerificationFailed");
  }
  static code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  constructor(message2 = "signature verification failed", options) {
    super(message2, options);
  }
};

// node_modules/jose/dist/webapi/lib/crypto_key.js
var unusable = /* @__PURE__ */ __name((name, prop = "algorithm.name") => new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`), "unusable");
var isAlgorithm = /* @__PURE__ */ __name((algorithm, name) => algorithm.name === name, "isAlgorithm");
function getHashLength(hash) {
  return parseInt(hash.name.slice(4), 10);
}
__name(getHashLength, "getHashLength");
function getNamedCurve(alg) {
  switch (alg) {
    case "ES256":
      return "P-256";
    case "ES384":
      return "P-384";
    case "ES512":
      return "P-521";
    default:
      throw new Error("unreachable");
  }
}
__name(getNamedCurve, "getNamedCurve");
function checkUsage(key, usage) {
  if (usage && !key.usages.includes(usage)) {
    throw new TypeError(`CryptoKey does not support this operation, its usages must include ${usage}.`);
  }
}
__name(checkUsage, "checkUsage");
function checkSigCryptoKey(key, alg, usage) {
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!isAlgorithm(key.algorithm, "HMAC"))
        throw unusable("HMAC");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!isAlgorithm(key.algorithm, "RSASSA-PKCS1-v1_5"))
        throw unusable("RSASSA-PKCS1-v1_5");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!isAlgorithm(key.algorithm, "RSA-PSS"))
        throw unusable("RSA-PSS");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "Ed25519":
    case "EdDSA": {
      if (!isAlgorithm(key.algorithm, "Ed25519"))
        throw unusable("Ed25519");
      break;
    }
    case "ML-DSA-44":
    case "ML-DSA-65":
    case "ML-DSA-87": {
      if (!isAlgorithm(key.algorithm, alg))
        throw unusable(alg);
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!isAlgorithm(key.algorithm, "ECDSA"))
        throw unusable("ECDSA");
      const expected = getNamedCurve(alg);
      const actual = key.algorithm.namedCurve;
      if (actual !== expected)
        throw unusable(expected, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  checkUsage(key, usage);
}
__name(checkSigCryptoKey, "checkSigCryptoKey");

// node_modules/jose/dist/webapi/lib/invalid_key_input.js
function message(msg, actual, ...types) {
  types = types.filter(Boolean);
  if (types.length > 2) {
    const last = types.pop();
    msg += `one of type ${types.join(", ")}, or ${last}.`;
  } else if (types.length === 2) {
    msg += `one of type ${types[0]} or ${types[1]}.`;
  } else {
    msg += `of type ${types[0]}.`;
  }
  if (actual == null) {
    msg += ` Received ${actual}`;
  } else if (typeof actual === "function" && actual.name) {
    msg += ` Received function ${actual.name}`;
  } else if (typeof actual === "object" && actual != null) {
    if (actual.constructor?.name) {
      msg += ` Received an instance of ${actual.constructor.name}`;
    }
  }
  return msg;
}
__name(message, "message");
var invalidKeyInput = /* @__PURE__ */ __name((actual, ...types) => message("Key must be ", actual, ...types), "invalidKeyInput");
var withAlg = /* @__PURE__ */ __name((alg, actual, ...types) => message(`Key for the ${alg} algorithm must be `, actual, ...types), "withAlg");

// node_modules/jose/dist/webapi/lib/is_key_like.js
var isCryptoKey = /* @__PURE__ */ __name((key) => {
  if (key?.[Symbol.toStringTag] === "CryptoKey")
    return true;
  try {
    return key instanceof CryptoKey;
  } catch {
    return false;
  }
}, "isCryptoKey");
var isKeyObject = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag] === "KeyObject", "isKeyObject");
var isKeyLike = /* @__PURE__ */ __name((key) => isCryptoKey(key) || isKeyObject(key), "isKeyLike");

// node_modules/jose/dist/webapi/lib/is_disjoint.js
function isDisjoint(...headers) {
  const sources = headers.filter(Boolean);
  if (sources.length === 0 || sources.length === 1) {
    return true;
  }
  let acc;
  for (const header of sources) {
    const parameters = Object.keys(header);
    if (!acc || acc.size === 0) {
      acc = new Set(parameters);
      continue;
    }
    for (const parameter of parameters) {
      if (acc.has(parameter)) {
        return false;
      }
      acc.add(parameter);
    }
  }
  return true;
}
__name(isDisjoint, "isDisjoint");

// node_modules/jose/dist/webapi/lib/is_object.js
var isObjectLike = /* @__PURE__ */ __name((value) => typeof value === "object" && value !== null, "isObjectLike");
function isObject(input) {
  if (!isObjectLike(input) || Object.prototype.toString.call(input) !== "[object Object]") {
    return false;
  }
  if (Object.getPrototypeOf(input) === null) {
    return true;
  }
  let proto = input;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(input) === proto;
}
__name(isObject, "isObject");

// node_modules/jose/dist/webapi/lib/check_key_length.js
function checkKeyLength(alg, key) {
  if (alg.startsWith("RS") || alg.startsWith("PS")) {
    const { modulusLength } = key.algorithm;
    if (typeof modulusLength !== "number" || modulusLength < 2048) {
      throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
    }
  }
}
__name(checkKeyLength, "checkKeyLength");

// node_modules/jose/dist/webapi/lib/jwk_to_key.js
function subtleMapping(jwk) {
  let algorithm;
  let keyUsages;
  switch (jwk.kty) {
    case "AKP": {
      switch (jwk.alg) {
        case "ML-DSA-44":
        case "ML-DSA-65":
        case "ML-DSA-87":
          algorithm = { name: jwk.alg };
          keyUsages = jwk.priv ? ["sign"] : ["verify"];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "RSA": {
      switch (jwk.alg) {
        case "PS256":
        case "PS384":
        case "PS512":
          algorithm = { name: "RSA-PSS", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RS256":
        case "RS384":
        case "RS512":
          algorithm = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RSA-OAEP":
        case "RSA-OAEP-256":
        case "RSA-OAEP-384":
        case "RSA-OAEP-512":
          algorithm = {
            name: "RSA-OAEP",
            hash: `SHA-${parseInt(jwk.alg.slice(-3), 10) || 1}`
          };
          keyUsages = jwk.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "EC": {
      switch (jwk.alg) {
        case "ES256":
          algorithm = { name: "ECDSA", namedCurve: "P-256" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES384":
          algorithm = { name: "ECDSA", namedCurve: "P-384" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES512":
          algorithm = { name: "ECDSA", namedCurve: "P-521" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: "ECDH", namedCurve: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "OKP": {
      switch (jwk.alg) {
        case "Ed25519":
        case "EdDSA":
          algorithm = { name: "Ed25519" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    default:
      throw new JOSENotSupported('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
  }
  return { algorithm, keyUsages };
}
__name(subtleMapping, "subtleMapping");
async function jwkToKey(jwk) {
  if (!jwk.alg) {
    throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  }
  const { algorithm, keyUsages } = subtleMapping(jwk);
  const keyData = { ...jwk };
  if (keyData.kty !== "AKP") {
    delete keyData.alg;
  }
  delete keyData.use;
  return crypto.subtle.importKey("jwk", keyData, algorithm, jwk.ext ?? (jwk.d || jwk.priv ? false : true), jwk.key_ops ?? keyUsages);
}
__name(jwkToKey, "jwkToKey");

// node_modules/jose/dist/webapi/lib/validate_crit.js
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0) {
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  }
  if (!protectedHeader || protectedHeader.crit === void 0) {
    return /* @__PURE__ */ new Set();
  }
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input !== "string" || input.length === 0)) {
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  }
  let recognized;
  if (recognizedOption !== void 0) {
    recognized = new Map([...Object.entries(recognizedOption), ...recognizedDefault.entries()]);
  } else {
    recognized = recognizedDefault;
  }
  for (const parameter of protectedHeader.crit) {
    if (!recognized.has(parameter)) {
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    }
    if (joseHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    }
    if (recognized.get(parameter) && protectedHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
    }
  }
  return new Set(protectedHeader.crit);
}
__name(validateCrit, "validateCrit");

// node_modules/jose/dist/webapi/lib/validate_algorithms.js
function validateAlgorithms(option, algorithms) {
  if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s !== "string"))) {
    throw new TypeError(`"${option}" option must be an array of strings`);
  }
  if (!algorithms) {
    return void 0;
  }
  return new Set(algorithms);
}
__name(validateAlgorithms, "validateAlgorithms");

// node_modules/jose/dist/webapi/lib/is_jwk.js
var isJWK = /* @__PURE__ */ __name((key) => isObject(key) && typeof key.kty === "string", "isJWK");
var isPrivateJWK = /* @__PURE__ */ __name((key) => key.kty !== "oct" && (key.kty === "AKP" && typeof key.priv === "string" || typeof key.d === "string"), "isPrivateJWK");
var isPublicJWK = /* @__PURE__ */ __name((key) => key.kty !== "oct" && key.d === void 0 && key.priv === void 0, "isPublicJWK");
var isSecretJWK = /* @__PURE__ */ __name((key) => key.kty === "oct" && typeof key.k === "string", "isSecretJWK");

// node_modules/jose/dist/webapi/lib/normalize_key.js
var cache;
var handleJWK = /* @__PURE__ */ __name(async (key, jwk, alg, freeze = false) => {
  cache ||= /* @__PURE__ */ new WeakMap();
  let cached = cache.get(key);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const cryptoKey = await jwkToKey({ ...jwk, alg });
  if (freeze)
    Object.freeze(key);
  if (!cached) {
    cache.set(key, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "handleJWK");
var handleKeyObject = /* @__PURE__ */ __name((keyObject, alg) => {
  cache ||= /* @__PURE__ */ new WeakMap();
  let cached = cache.get(keyObject);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const isPublic = keyObject.type === "public";
  const extractable = isPublic ? true : false;
  let cryptoKey;
  if (keyObject.asymmetricKeyType === "x25519") {
    switch (alg) {
      case "ECDH-ES":
      case "ECDH-ES+A128KW":
      case "ECDH-ES+A192KW":
      case "ECDH-ES+A256KW":
        break;
      default:
        throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, isPublic ? [] : ["deriveBits"]);
  }
  if (keyObject.asymmetricKeyType === "ed25519") {
    if (alg !== "EdDSA" && alg !== "Ed25519") {
      throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
      isPublic ? "verify" : "sign"
    ]);
  }
  switch (keyObject.asymmetricKeyType) {
    case "ml-dsa-44":
    case "ml-dsa-65":
    case "ml-dsa-87": {
      if (alg !== keyObject.asymmetricKeyType.toUpperCase()) {
        throw new TypeError("given KeyObject instance cannot be used for this algorithm");
      }
      cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
        isPublic ? "verify" : "sign"
      ]);
    }
  }
  if (keyObject.asymmetricKeyType === "rsa") {
    let hash;
    switch (alg) {
      case "RSA-OAEP":
        hash = "SHA-1";
        break;
      case "RS256":
      case "PS256":
      case "RSA-OAEP-256":
        hash = "SHA-256";
        break;
      case "RS384":
      case "PS384":
      case "RSA-OAEP-384":
        hash = "SHA-384";
        break;
      case "RS512":
      case "PS512":
      case "RSA-OAEP-512":
        hash = "SHA-512";
        break;
      default:
        throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    if (alg.startsWith("RSA-OAEP")) {
      return keyObject.toCryptoKey({
        name: "RSA-OAEP",
        hash
      }, extractable, isPublic ? ["encrypt"] : ["decrypt"]);
    }
    cryptoKey = keyObject.toCryptoKey({
      name: alg.startsWith("PS") ? "RSA-PSS" : "RSASSA-PKCS1-v1_5",
      hash
    }, extractable, [isPublic ? "verify" : "sign"]);
  }
  if (keyObject.asymmetricKeyType === "ec") {
    const nist = /* @__PURE__ */ new Map([
      ["prime256v1", "P-256"],
      ["secp384r1", "P-384"],
      ["secp521r1", "P-521"]
    ]);
    const namedCurve = nist.get(keyObject.asymmetricKeyDetails?.namedCurve);
    if (!namedCurve) {
      throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    if (alg === "ES256" && namedCurve === "P-256") {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg === "ES384" && namedCurve === "P-384") {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg === "ES512" && namedCurve === "P-521") {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg.startsWith("ECDH-ES")) {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDH",
        namedCurve
      }, extractable, isPublic ? [] : ["deriveBits"]);
    }
  }
  if (!cryptoKey) {
    throw new TypeError("given KeyObject instance cannot be used for this algorithm");
  }
  if (!cached) {
    cache.set(keyObject, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "handleKeyObject");
async function normalizeKey(key, alg) {
  if (key instanceof Uint8Array) {
    return key;
  }
  if (isCryptoKey(key)) {
    return key;
  }
  if (isKeyObject(key)) {
    if (key.type === "secret") {
      return key.export();
    }
    if ("toCryptoKey" in key && typeof key.toCryptoKey === "function") {
      try {
        return handleKeyObject(key, alg);
      } catch (err) {
        if (err instanceof TypeError) {
          throw err;
        }
      }
    }
    let jwk = key.export({ format: "jwk" });
    return handleJWK(key, jwk, alg);
  }
  if (isJWK(key)) {
    if (key.k) {
      return decode(key.k);
    }
    return handleJWK(key, key, alg, true);
  }
  throw new Error("unreachable");
}
__name(normalizeKey, "normalizeKey");

// node_modules/jose/dist/webapi/lib/check_key_type.js
var tag = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag], "tag");
var jwkMatchesOp = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key.use !== void 0) {
    let expected;
    switch (usage) {
      case "sign":
      case "verify":
        expected = "sig";
        break;
      case "encrypt":
      case "decrypt":
        expected = "enc";
        break;
    }
    if (key.use !== expected) {
      throw new TypeError(`Invalid key for this operation, its "use" must be "${expected}" when present`);
    }
  }
  if (key.alg !== void 0 && key.alg !== alg) {
    throw new TypeError(`Invalid key for this operation, its "alg" must be "${alg}" when present`);
  }
  if (Array.isArray(key.key_ops)) {
    let expectedKeyOp;
    switch (true) {
      case (usage === "sign" || usage === "verify"):
      case alg === "dir":
      case alg.includes("CBC-HS"):
        expectedKeyOp = usage;
        break;
      case alg.startsWith("PBES2"):
        expectedKeyOp = "deriveBits";
        break;
      case /^A\d{3}(?:GCM)?(?:KW)?$/.test(alg):
        if (!alg.includes("GCM") && alg.endsWith("KW")) {
          expectedKeyOp = usage === "encrypt" ? "wrapKey" : "unwrapKey";
        } else {
          expectedKeyOp = usage;
        }
        break;
      case (usage === "encrypt" && alg.startsWith("RSA")):
        expectedKeyOp = "wrapKey";
        break;
      case usage === "decrypt":
        expectedKeyOp = alg.startsWith("RSA") ? "unwrapKey" : "deriveBits";
        break;
    }
    if (expectedKeyOp && key.key_ops?.includes?.(expectedKeyOp) === false) {
      throw new TypeError(`Invalid key for this operation, its "key_ops" must include "${expectedKeyOp}" when present`);
    }
  }
  return true;
}, "jwkMatchesOp");
var symmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key instanceof Uint8Array)
    return;
  if (isJWK(key)) {
    if (isSecretJWK(key) && jwkMatchesOp(alg, key, usage))
      return;
    throw new TypeError(`JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present`);
  }
  if (!isKeyLike(key)) {
    throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key", "Uint8Array"));
  }
  if (key.type !== "secret") {
    throw new TypeError(`${tag(key)} instances for symmetric algorithms must be of type "secret"`);
  }
}, "symmetricTypeCheck");
var asymmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage) => {
  if (isJWK(key)) {
    switch (usage) {
      case "decrypt":
      case "sign":
        if (isPrivateJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation must be a private JWK`);
      case "encrypt":
      case "verify":
        if (isPublicJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation must be a public JWK`);
    }
  }
  if (!isKeyLike(key)) {
    throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key"));
  }
  if (key.type === "secret") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithms must not be of type "secret"`);
  }
  if (key.type === "public") {
    switch (usage) {
      case "sign":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm signing must be of type "private"`);
      case "decrypt":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm decryption must be of type "private"`);
    }
  }
  if (key.type === "private") {
    switch (usage) {
      case "verify":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm verifying must be of type "public"`);
      case "encrypt":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm encryption must be of type "public"`);
    }
  }
}, "asymmetricTypeCheck");
function checkKeyType(alg, key, usage) {
  switch (alg.substring(0, 2)) {
    case "A1":
    case "A2":
    case "di":
    case "HS":
    case "PB":
      symmetricTypeCheck(alg, key, usage);
      break;
    default:
      asymmetricTypeCheck(alg, key, usage);
  }
}
__name(checkKeyType, "checkKeyType");

// node_modules/jose/dist/webapi/lib/subtle_dsa.js
function subtleAlgorithm(alg, algorithm) {
  const hash = `SHA-${alg.slice(-3)}`;
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512":
      return { hash, name: "HMAC" };
    case "PS256":
    case "PS384":
    case "PS512":
      return { hash, name: "RSA-PSS", saltLength: parseInt(alg.slice(-3), 10) >> 3 };
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash, name: "RSASSA-PKCS1-v1_5" };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash, name: "ECDSA", namedCurve: algorithm.namedCurve };
    case "Ed25519":
    case "EdDSA":
      return { name: "Ed25519" };
    case "ML-DSA-44":
    case "ML-DSA-65":
    case "ML-DSA-87":
      return { name: alg };
    default:
      throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  }
}
__name(subtleAlgorithm, "subtleAlgorithm");

// node_modules/jose/dist/webapi/lib/get_sign_verify_key.js
async function getSigKey(alg, key, usage) {
  if (key instanceof Uint8Array) {
    if (!alg.startsWith("HS")) {
      throw new TypeError(invalidKeyInput(key, "CryptoKey", "KeyObject", "JSON Web Key"));
    }
    return crypto.subtle.importKey("raw", key, { hash: `SHA-${alg.slice(-3)}`, name: "HMAC" }, false, [usage]);
  }
  checkSigCryptoKey(key, alg, usage);
  return key;
}
__name(getSigKey, "getSigKey");

// node_modules/jose/dist/webapi/lib/verify.js
async function verify(alg, key, signature, data) {
  const cryptoKey = await getSigKey(alg, key, "verify");
  checkKeyLength(alg, cryptoKey);
  const algorithm = subtleAlgorithm(alg, cryptoKey.algorithm);
  try {
    return await crypto.subtle.verify(algorithm, cryptoKey, signature, data);
  } catch {
    return false;
  }
}
__name(verify, "verify");

// node_modules/jose/dist/webapi/jws/flattened/verify.js
async function flattenedVerify(jws, key, options) {
  if (!isObject(jws)) {
    throw new JWSInvalid("Flattened JWS must be an object");
  }
  if (jws.protected === void 0 && jws.header === void 0) {
    throw new JWSInvalid('Flattened JWS must have either of the "protected" or "header" members');
  }
  if (jws.protected !== void 0 && typeof jws.protected !== "string") {
    throw new JWSInvalid("JWS Protected Header incorrect type");
  }
  if (jws.payload === void 0) {
    throw new JWSInvalid("JWS Payload missing");
  }
  if (typeof jws.signature !== "string") {
    throw new JWSInvalid("JWS Signature missing or incorrect type");
  }
  if (jws.header !== void 0 && !isObject(jws.header)) {
    throw new JWSInvalid("JWS Unprotected Header incorrect type");
  }
  let parsedProt = {};
  if (jws.protected) {
    try {
      const protectedHeader = decode(jws.protected);
      parsedProt = JSON.parse(decoder.decode(protectedHeader));
    } catch {
      throw new JWSInvalid("JWS Protected Header is invalid");
    }
  }
  if (!isDisjoint(parsedProt, jws.header)) {
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  }
  const joseHeader = {
    ...parsedProt,
    ...jws.header
  };
  const extensions = validateCrit(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, parsedProt, joseHeader);
  let b64 = true;
  if (extensions.has("b64")) {
    b64 = parsedProt.b64;
    if (typeof b64 !== "boolean") {
      throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    }
  }
  const { alg } = joseHeader;
  if (typeof alg !== "string" || !alg) {
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  }
  const algorithms = options && validateAlgorithms("algorithms", options.algorithms);
  if (algorithms && !algorithms.has(alg)) {
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  }
  if (b64) {
    if (typeof jws.payload !== "string") {
      throw new JWSInvalid("JWS Payload must be a string");
    }
  } else if (typeof jws.payload !== "string" && !(jws.payload instanceof Uint8Array)) {
    throw new JWSInvalid("JWS Payload must be a string or an Uint8Array instance");
  }
  let resolvedKey = false;
  if (typeof key === "function") {
    key = await key(parsedProt, jws);
    resolvedKey = true;
  }
  checkKeyType(alg, key, "verify");
  const data = concat(jws.protected !== void 0 ? encode(jws.protected) : new Uint8Array(), encode("."), typeof jws.payload === "string" ? b64 ? encode(jws.payload) : encoder.encode(jws.payload) : jws.payload);
  let signature;
  try {
    signature = decode(jws.signature);
  } catch {
    throw new JWSInvalid("Failed to base64url decode the signature");
  }
  const k = await normalizeKey(key, alg);
  const verified = await verify(alg, k, signature, data);
  if (!verified) {
    throw new JWSSignatureVerificationFailed();
  }
  let payload;
  if (b64) {
    try {
      payload = decode(jws.payload);
    } catch {
      throw new JWSInvalid("Failed to base64url decode the payload");
    }
  } else if (typeof jws.payload === "string") {
    payload = encoder.encode(jws.payload);
  } else {
    payload = jws.payload;
  }
  const result = { payload };
  if (jws.protected !== void 0) {
    result.protectedHeader = parsedProt;
  }
  if (jws.header !== void 0) {
    result.unprotectedHeader = jws.header;
  }
  if (resolvedKey) {
    return { ...result, key: k };
  }
  return result;
}
__name(flattenedVerify, "flattenedVerify");

// node_modules/jose/dist/webapi/jws/compact/verify.js
async function compactVerify(jws, key, options) {
  if (jws instanceof Uint8Array) {
    jws = decoder.decode(jws);
  }
  if (typeof jws !== "string") {
    throw new JWSInvalid("Compact JWS must be a string or Uint8Array");
  }
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
  if (length !== 3) {
    throw new JWSInvalid("Invalid Compact JWS");
  }
  const verified = await flattenedVerify({ payload, protected: protectedHeader, signature }, key, options);
  const result = { payload: verified.payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(compactVerify, "compactVerify");

// node_modules/jose/dist/webapi/lib/jwt_claims_set.js
var epoch = /* @__PURE__ */ __name((date) => Math.floor(date.getTime() / 1e3), "epoch");
var minute = 60;
var hour = minute * 60;
var day = hour * 24;
var week = day * 7;
var year = day * 365.25;
var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
function secs(str) {
  const matched = REGEX.exec(str);
  if (!matched || matched[4] && matched[1]) {
    throw new TypeError("Invalid time period format");
  }
  const value = parseFloat(matched[2]);
  const unit = matched[3].toLowerCase();
  let numericDate;
  switch (unit) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      numericDate = Math.round(value);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      numericDate = Math.round(value * minute);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      numericDate = Math.round(value * hour);
      break;
    case "day":
    case "days":
    case "d":
      numericDate = Math.round(value * day);
      break;
    case "week":
    case "weeks":
    case "w":
      numericDate = Math.round(value * week);
      break;
    default:
      numericDate = Math.round(value * year);
      break;
  }
  if (matched[1] === "-" || matched[4] === "ago") {
    return -numericDate;
  }
  return numericDate;
}
__name(secs, "secs");
function validateInput(label, input) {
  if (!Number.isFinite(input)) {
    throw new TypeError(`Invalid ${label} input`);
  }
  return input;
}
__name(validateInput, "validateInput");
var normalizeTyp = /* @__PURE__ */ __name((value) => {
  if (value.includes("/")) {
    return value.toLowerCase();
  }
  return `application/${value.toLowerCase()}`;
}, "normalizeTyp");
var checkAudiencePresence = /* @__PURE__ */ __name((audPayload, audOption) => {
  if (typeof audPayload === "string") {
    return audOption.includes(audPayload);
  }
  if (Array.isArray(audPayload)) {
    return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
  }
  return false;
}, "checkAudiencePresence");
function validateClaimsSet(protectedHeader, encodedPayload, options = {}) {
  let payload;
  try {
    payload = JSON.parse(decoder.decode(encodedPayload));
  } catch {
  }
  if (!isObject(payload)) {
    throw new JWTInvalid("JWT Claims Set must be a top-level JSON object");
  }
  const { typ } = options;
  if (typ && (typeof protectedHeader.typ !== "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) {
    throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', payload, "typ", "check_failed");
  }
  const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options;
  const presenceCheck = [...requiredClaims];
  if (maxTokenAge !== void 0)
    presenceCheck.push("iat");
  if (audience !== void 0)
    presenceCheck.push("aud");
  if (subject !== void 0)
    presenceCheck.push("sub");
  if (issuer !== void 0)
    presenceCheck.push("iss");
  for (const claim of new Set(presenceCheck.reverse())) {
    if (!(claim in payload)) {
      throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, payload, claim, "missing");
    }
  }
  if (issuer && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss)) {
    throw new JWTClaimValidationFailed('unexpected "iss" claim value', payload, "iss", "check_failed");
  }
  if (subject && payload.sub !== subject) {
    throw new JWTClaimValidationFailed('unexpected "sub" claim value', payload, "sub", "check_failed");
  }
  if (audience && !checkAudiencePresence(payload.aud, typeof audience === "string" ? [audience] : audience)) {
    throw new JWTClaimValidationFailed('unexpected "aud" claim value', payload, "aud", "check_failed");
  }
  let tolerance;
  switch (typeof options.clockTolerance) {
    case "string":
      tolerance = secs(options.clockTolerance);
      break;
    case "number":
      tolerance = options.clockTolerance;
      break;
    case "undefined":
      tolerance = 0;
      break;
    default:
      throw new TypeError("Invalid clockTolerance option type");
  }
  const { currentDate } = options;
  const now = epoch(currentDate || /* @__PURE__ */ new Date());
  if ((payload.iat !== void 0 || maxTokenAge) && typeof payload.iat !== "number") {
    throw new JWTClaimValidationFailed('"iat" claim must be a number', payload, "iat", "invalid");
  }
  if (payload.nbf !== void 0) {
    if (typeof payload.nbf !== "number") {
      throw new JWTClaimValidationFailed('"nbf" claim must be a number', payload, "nbf", "invalid");
    }
    if (payload.nbf > now + tolerance) {
      throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', payload, "nbf", "check_failed");
    }
  }
  if (payload.exp !== void 0) {
    if (typeof payload.exp !== "number") {
      throw new JWTClaimValidationFailed('"exp" claim must be a number', payload, "exp", "invalid");
    }
    if (payload.exp <= now - tolerance) {
      throw new JWTExpired('"exp" claim timestamp check failed', payload, "exp", "check_failed");
    }
  }
  if (maxTokenAge) {
    const age = now - payload.iat;
    const max = typeof maxTokenAge === "number" ? maxTokenAge : secs(maxTokenAge);
    if (age - tolerance > max) {
      throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', payload, "iat", "check_failed");
    }
    if (age < 0 - tolerance) {
      throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', payload, "iat", "check_failed");
    }
  }
  return payload;
}
__name(validateClaimsSet, "validateClaimsSet");
var JWTClaimsBuilder = class {
  static {
    __name(this, "JWTClaimsBuilder");
  }
  #payload;
  constructor(payload) {
    if (!isObject(payload)) {
      throw new TypeError("JWT Claims Set MUST be an object");
    }
    this.#payload = structuredClone(payload);
  }
  data() {
    return encoder.encode(JSON.stringify(this.#payload));
  }
  get iss() {
    return this.#payload.iss;
  }
  set iss(value) {
    this.#payload.iss = value;
  }
  get sub() {
    return this.#payload.sub;
  }
  set sub(value) {
    this.#payload.sub = value;
  }
  get aud() {
    return this.#payload.aud;
  }
  set aud(value) {
    this.#payload.aud = value;
  }
  set jti(value) {
    this.#payload.jti = value;
  }
  set nbf(value) {
    if (typeof value === "number") {
      this.#payload.nbf = validateInput("setNotBefore", value);
    } else if (value instanceof Date) {
      this.#payload.nbf = validateInput("setNotBefore", epoch(value));
    } else {
      this.#payload.nbf = epoch(/* @__PURE__ */ new Date()) + secs(value);
    }
  }
  set exp(value) {
    if (typeof value === "number") {
      this.#payload.exp = validateInput("setExpirationTime", value);
    } else if (value instanceof Date) {
      this.#payload.exp = validateInput("setExpirationTime", epoch(value));
    } else {
      this.#payload.exp = epoch(/* @__PURE__ */ new Date()) + secs(value);
    }
  }
  set iat(value) {
    if (value === void 0) {
      this.#payload.iat = epoch(/* @__PURE__ */ new Date());
    } else if (value instanceof Date) {
      this.#payload.iat = validateInput("setIssuedAt", epoch(value));
    } else if (typeof value === "string") {
      this.#payload.iat = validateInput("setIssuedAt", epoch(/* @__PURE__ */ new Date()) + secs(value));
    } else {
      this.#payload.iat = validateInput("setIssuedAt", value);
    }
  }
};

// node_modules/jose/dist/webapi/jwt/verify.js
async function jwtVerify(jwt, key, options) {
  const verified = await compactVerify(jwt, key, options);
  if (verified.protectedHeader.crit?.includes("b64") && verified.protectedHeader.b64 === false) {
    throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
  }
  const payload = validateClaimsSet(verified.protectedHeader, verified.payload, options);
  const result = { payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(jwtVerify, "jwtVerify");

// node_modules/jose/dist/webapi/lib/sign.js
async function sign(alg, key, data) {
  const cryptoKey = await getSigKey(alg, key, "sign");
  checkKeyLength(alg, cryptoKey);
  const signature = await crypto.subtle.sign(subtleAlgorithm(alg, cryptoKey.algorithm), cryptoKey, data);
  return new Uint8Array(signature);
}
__name(sign, "sign");

// node_modules/jose/dist/webapi/jws/flattened/sign.js
var FlattenedSign = class {
  static {
    __name(this, "FlattenedSign");
  }
  #payload;
  #protectedHeader;
  #unprotectedHeader;
  constructor(payload) {
    if (!(payload instanceof Uint8Array)) {
      throw new TypeError("payload must be an instance of Uint8Array");
    }
    this.#payload = payload;
  }
  setProtectedHeader(protectedHeader) {
    if (this.#protectedHeader) {
      throw new TypeError("setProtectedHeader can only be called once");
    }
    this.#protectedHeader = protectedHeader;
    return this;
  }
  setUnprotectedHeader(unprotectedHeader) {
    if (this.#unprotectedHeader) {
      throw new TypeError("setUnprotectedHeader can only be called once");
    }
    this.#unprotectedHeader = unprotectedHeader;
    return this;
  }
  async sign(key, options) {
    if (!this.#protectedHeader && !this.#unprotectedHeader) {
      throw new JWSInvalid("either setProtectedHeader or setUnprotectedHeader must be called before #sign()");
    }
    if (!isDisjoint(this.#protectedHeader, this.#unprotectedHeader)) {
      throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
    }
    const joseHeader = {
      ...this.#protectedHeader,
      ...this.#unprotectedHeader
    };
    const extensions = validateCrit(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, this.#protectedHeader, joseHeader);
    let b64 = true;
    if (extensions.has("b64")) {
      b64 = this.#protectedHeader.b64;
      if (typeof b64 !== "boolean") {
        throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
      }
    }
    const { alg } = joseHeader;
    if (typeof alg !== "string" || !alg) {
      throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
    }
    checkKeyType(alg, key, "sign");
    let payloadS;
    let payloadB;
    if (b64) {
      payloadS = encode2(this.#payload);
      payloadB = encode(payloadS);
    } else {
      payloadB = this.#payload;
      payloadS = "";
    }
    let protectedHeaderString;
    let protectedHeaderBytes;
    if (this.#protectedHeader) {
      protectedHeaderString = encode2(JSON.stringify(this.#protectedHeader));
      protectedHeaderBytes = encode(protectedHeaderString);
    } else {
      protectedHeaderString = "";
      protectedHeaderBytes = new Uint8Array();
    }
    const data = concat(protectedHeaderBytes, encode("."), payloadB);
    const k = await normalizeKey(key, alg);
    const signature = await sign(alg, k, data);
    const jws = {
      signature: encode2(signature),
      payload: payloadS
    };
    if (this.#unprotectedHeader) {
      jws.header = this.#unprotectedHeader;
    }
    if (this.#protectedHeader) {
      jws.protected = protectedHeaderString;
    }
    return jws;
  }
};

// node_modules/jose/dist/webapi/jws/compact/sign.js
var CompactSign = class {
  static {
    __name(this, "CompactSign");
  }
  #flattened;
  constructor(payload) {
    this.#flattened = new FlattenedSign(payload);
  }
  setProtectedHeader(protectedHeader) {
    this.#flattened.setProtectedHeader(protectedHeader);
    return this;
  }
  async sign(key, options) {
    const jws = await this.#flattened.sign(key, options);
    if (jws.payload === void 0) {
      throw new TypeError("use the flattened module for creating JWS with b64: false");
    }
    return `${jws.protected}.${jws.payload}.${jws.signature}`;
  }
};

// node_modules/jose/dist/webapi/jwt/sign.js
var SignJWT = class {
  static {
    __name(this, "SignJWT");
  }
  #protectedHeader;
  #jwt;
  constructor(payload = {}) {
    this.#jwt = new JWTClaimsBuilder(payload);
  }
  setIssuer(issuer) {
    this.#jwt.iss = issuer;
    return this;
  }
  setSubject(subject) {
    this.#jwt.sub = subject;
    return this;
  }
  setAudience(audience) {
    this.#jwt.aud = audience;
    return this;
  }
  setJti(jwtId) {
    this.#jwt.jti = jwtId;
    return this;
  }
  setNotBefore(input) {
    this.#jwt.nbf = input;
    return this;
  }
  setExpirationTime(input) {
    this.#jwt.exp = input;
    return this;
  }
  setIssuedAt(input) {
    this.#jwt.iat = input;
    return this;
  }
  setProtectedHeader(protectedHeader) {
    this.#protectedHeader = protectedHeader;
    return this;
  }
  async sign(key, options) {
    const sig = new CompactSign(this.#jwt.data());
    sig.setProtectedHeader(this.#protectedHeader);
    if (Array.isArray(this.#protectedHeader?.crit) && this.#protectedHeader.crit.includes("b64") && this.#protectedHeader.b64 === false) {
      throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
    }
    return sig.sign(key, options);
  }
};

// src/index.ts
var CARD_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
var CREATOR_CDN_BASE = "https://cdn.codeoce.com/";
function getR2KeyFromImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  if (!imageUrl.startsWith(CREATOR_CDN_BASE)) return null;
  const key = imageUrl.slice(CREATOR_CDN_BASE.length).split("?")[0].trim();
  return key.length > 0 ? key : null;
}
__name(getR2KeyFromImageUrl, "getR2KeyFromImageUrl");
async function getUserFromSession(request, env, supabase) {
  const cookie = request.headers.get("Cookie") || "";
  const token = cookie.match(/(?:^|; )session=([^;]*)/)?.[1];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.SESSION_SECRET)
    );
    const twitchId = payload.sub || payload.twitch_id || payload.id;
    if (!twitchId) return null;
    const { data: user, error } = await supabase.from("users").select("twitch_id, username, avatar_url, binder_layout, binder_theme, onboarding_collector_step, is_onboarding_complete").eq("twitch_id", twitchId.toString()).single();
    if (error || !user) return null;
    return user;
  } catch (e) {
  }
}
__name(getUserFromSession, "getUserFromSession");
async function getTwitchFollows(twitchId, accessToken, clientId) {
  if (!accessToken) return [];
  const allFollows = [];
  let cursor = "";
  let pagesFetched = 0;
  const MAX_PAGES = 5;
  try {
    do {
      const url = `https://api.twitch.tv/helix/channels/followed?user_id=${twitchId}&first=100${cursor ? `&after=${cursor}` : ""}`;
      const resp = await fetch(url, {
        headers: {
          "Client-ID": clientId,
          "Authorization": `Bearer ${accessToken}`
        }
      });
      if (!resp.ok) {
        const errorText = await resp.text();
        console.error(`[Twitch] Follows fetch failed on page ${pagesFetched + 1}:`, errorText);
        break;
      }
      const data = await resp.json();
      const pageData = data.data || [];
      allFollows.push(...pageData);
      cursor = data.pagination?.cursor || "";
      pagesFetched++;
      if (!cursor) break;
    } while (pagesFetched < MAX_PAGES);
    console.log(`[Twitch] Follows summary for ${twitchId}: Total ${allFollows.length} across ${pagesFetched} pages.`);
    return allFollows;
  } catch (e) {
    console.error("[Twitch] Follows fatal fetch error:", e);
    return allFollows;
  }
}
__name(getTwitchFollows, "getTwitchFollows");
async function getStreamerForCreator(user, supabase) {
  const { data } = await supabase.from("streamers").select("*").eq("twitch_id", user.twitch_id).maybeSingle();
  return data;
}
__name(getStreamerForCreator, "getStreamerForCreator");
async function encryptSensitive(text, secret) {
  const encoder2 = new TextEncoder();
  const data = encoder2.encode(text);
  const keyBuf = encoder2.encode(secret.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey("raw", keyBuf, { name: "AES-CBC" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, data);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}
__name(encryptSensitive, "encryptSensitive");
async function decryptSensitive(encryptedBase64, secret) {
  const combined = new Uint8Array(atob(encryptedBase64).split("").map((c) => c.charCodeAt(0)));
  const iv = combined.slice(0, 16);
  const data = combined.slice(16);
  const encoder2 = new TextEncoder();
  const keyBuf = encoder2.encode(secret.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey("raw", keyBuf, { name: "AES-CBC" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}
__name(decryptSensitive, "decryptSensitive");
async function resolveStreamerContext(request, supabase, url) {
  const rawParam = url.searchParams.get("streamer_id") || url.searchParams.get("creator_id") || url.searchParams.get("streamer");
  const streamerId = rawParam;
  if (streamerId) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(streamerId);
    if (isUuid) {
      const { data: streamer } = await supabase.from("streamers").select("*").eq("id", streamerId).maybeSingle();
      if (streamer) return streamer;
    }
    const { data: streamerByNick } = await supabase.from("streamers").select("*").ilike("username", streamerId).maybeSingle();
    if (streamerByNick) return streamerByNick;
  }
  const { data: defaultStreamer } = await supabase.from("streamers").select("*").ilike("username", "codeoce").maybeSingle();
  return defaultStreamer;
}
__name(resolveStreamerContext, "resolveStreamerContext");
async function verifyTwitchSignature(secret, signature, id, timestamp, body) {
  const encoder2 = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder2.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signatureBytes = new Uint8Array(signature.split("=")[1].match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  return crypto.subtle.verify("HMAC", key, signatureBytes, encoder2.encode(id + timestamp + body));
}
__name(verifyTwitchSignature, "verifyTwitchSignature");
async function handleTwitchWebhook(req, env) {
  console.log("[Webhook] Received request");
  const signature = req.headers.get("Twitch-Eventsub-Message-Signature");
  const timestamp = req.headers.get("Twitch-Eventsub-Message-Timestamp");
  const id = req.headers.get("Twitch-Eventsub-Message-Id");
  const messageType = req.headers.get("Twitch-Eventsub-Message-Type");
  const body = await req.text();
  console.log("[Webhook] Message Type:", messageType);
  if (!signature || !timestamp || !id) {
    console.error("[Webhook] Missing required headers");
    return new Response("Missing headers", { status: 403 });
  }
  const isValidSignature = await verifyTwitchSignature(env.TWITCH_WEBHOOK_SECRET, signature, id, timestamp, body);
  if (!isValidSignature) {
    console.error("[Webhook] Invalid signature");
    return new Response("Invalid Signature", { status: 403 });
  }
  let json;
  try {
    json = JSON.parse(body);
  } catch (e) {
    console.error("[Webhook] Failed to parse JSON:", e);
    return new Response("Invalid JSON", { status: 400 });
  }
  if (json.challenge) {
    console.log("[Webhook] \u2705 Responding to verification challenge:", json.challenge);
    return new Response(json.challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  if (!json.event) {
    console.log("[Webhook] No event data in payload, returning OK");
    return new Response("OK", { status: 200 });
  }
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  if (json.subscription.type === "channel.channel_points_custom_reward_redemption.add") {
    const redeemedRewardId = json.event.reward.id;
    const broadcasterId = json.event.broadcaster_user_id;
    const userId = json.event.user_id;
    const userName = json.event.user_name || json.event.user_login;
    console.log(`[Webhook] Reward redemption: ${json.event.reward.title} by ${userName}`);
    const { data: streamer, error: sErr } = await supabase.from("streamers").select("*").eq("twitch_id", broadcasterId).maybeSingle();
    if (sErr || !streamer) {
      console.error(`[Webhook] Streamer not found for broadcaster_id: ${broadcasterId}`);
      return new Response("Streamer not found", { status: 200 });
    }
    if (redeemedRewardId === streamer.twitch_reward_id) {
      console.log(`[Webhook] Granting card for ${userName} in ${streamer.username}'s stream`);
      await grantRandomCard(supabase, userId, userName, streamer.id, `\u{1F3F0} Redemption: ${json.event.reward.title}!`, env);
    }
    if (streamer.twitch_battle_reward_id && redeemedRewardId === streamer.twitch_battle_reward_id) {
      console.log(`[Webhook] Battle redemption by ${userName}`);
      const userInput = json.event.user_input || "";
      const targetUser = userInput.replace("@", "").trim();
      if (targetUser) {
        console.log(`[Webhook] Battle: ${userName} vs ${targetUser}`);
      }
    }
  }
  return new Response("OK", { status: 200 });
}
__name(handleTwitchWebhook, "handleTwitchWebhook");
async function assignMechanic(supabase) {
  try {
    const { data: mechanics } = await supabase.from("mechanics").select("id, rarity_weight").eq("is_active", true);
    if (!mechanics || mechanics.length === 0) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const m of mechanics) {
      const score = Math.random() ** (1 / Math.max(m.rarity_weight || 1, 1));
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best?.id ?? null;
  } catch (e) {
    console.error("[assignMechanic] Error:", e.message);
    return null;
  }
}
__name(assignMechanic, "assignMechanic");
function runBattleEngine(challenger, target, challengerDeck, targetDeck) {
  const roundResult = simulateMatchRound(1, challenger, target, challengerDeck, targetDeck);
  const matchRounds = [roundResult];
  const finalWinner = roundResult.winner;
  return {
    challenger: { name: challenger.name, avatar: challenger.avatar, twitch_id: challenger.twitch_id, matchWins: finalWinner === "challenger" ? 1 : 0 },
    target: { name: target.name, avatar: target.avatar, twitch_id: target.twitch_id, matchWins: finalWinner === "target" ? 1 : 0 },
    winner: finalWinner,
    winnerId: finalWinner === "challenger" ? challenger.twitch_id : finalWinner === "target" ? target.twitch_id : null,
    initialChallengerDeck: challengerDeck,
    initialTargetDeck: targetDeck,
    matchRounds,
    rounds: roundResult.exchanges
  };
}
__name(runBattleEngine, "runBattleEngine");
function simulateMatchRound(roundNum, challenger, target, cDeck, tDeck) {
  const mkState = /* @__PURE__ */ __name((card, slot) => {
    const traits = [];
    if (card.mechanic_name) traits.push({ name: card.mechanic_name, icon: card.mechanic_icon });
    if (card.genesis_mechanic_name) traits.push({ name: card.genesis_mechanic_name, icon: card.genesis_mechanic_icon });
    return {
      id: card.id,
      name: card.name,
      image_url: card.image_url || "",
      traits,
      base_attack: card.attack || 0,
      base_defense: card.defense || 0,
      attack: card.attack || 0,
      defense: card.defense || 0,
      max_defense: card.defense || 0,
      slot,
      // 1=Left, 2=Middle, 3=Right
      alive: true,
      reviveUsed: false
    };
  }, "mkState");
  const cCards = cDeck.map((c, i) => mkState(c, i + 1));
  const tCards = tDeck.map((c, i) => mkState(c, i + 1));
  const recalculateMimics = /* @__PURE__ */ __name((cards, eventLog, sideLabel) => {
    cards.forEach((card) => {
      const hasMimic = card.traits.some((t) => t.name === "mimic");
      if (hasMimic && card.alive) {
        const left = cards.find((c) => c.slot === card.slot - 1 && c.alive);
        const right = cards.find((c) => c.slot === card.slot + 1 && c.alive);
        let triggered = false;
        if (left && (card.attack !== left.attack || card.defense !== left.defense)) {
          card.attack = left.attack;
          card.defense = left.defense;
          triggered = true;
        }
        if (right && right.traits.length > 0) {
          const newTrait = right.traits[0];
          if (!card.traits.some((t) => t.name === newTrait.name)) {
            card.traits.push({ ...newTrait });
            triggered = true;
          }
        }
        if (triggered && typeof eventLog !== "undefined" && eventLog) {
          eventLog.push({
            type: "mimic_trigger",
            side: sideLabel,
            card: card.name,
            slot: card.slot,
            attack: card.attack,
            defense: card.defense,
            mechanic: card.traits.map((t) => t.name).join(", ")
          });
        }
      }
    });
  }, "recalculateMimics");
  recalculateMimics(cCards, [], "challenger");
  recalculateMimics(tCards, [], "target");
  const exchanges = [];
  const coinFlip = Math.random() > 0.5 ? "challenger" : "target";
  let attackerSide = coinFlip;
  const MAX_EXCHANGES = 50;
  let exchangeCount = 0;
  while (cCards.some((c) => c.alive) && tCards.some((c) => c.alive) && exchangeCount < MAX_EXCHANGES) {
    exchangeCount++;
    const attackers = attackerSide === "challenger" ? cCards : tCards;
    const defenders = attackerSide === "challenger" ? tCards : cCards;
    const activeAttacker = attackers.find((c) => c.alive);
    if (!activeAttacker) break;
    let activeDefender = defenders.find((c) => c.alive && c.traits.some((t) => t.name === "guard"));
    if (!activeDefender) activeDefender = defenders.find((c) => c.alive);
    if (!activeDefender) break;
    const exchangeData = {
      exchange: exchangeCount,
      side: attackerSide,
      challengerCard: null,
      targetCard: null,
      events: []
    };
    const cActive = attackers === cCards ? activeAttacker : activeDefender;
    const tActive = attackers === tCards ? activeAttacker : activeDefender;
    const snapshot = /* @__PURE__ */ __name((c) => ({
      ...c,
      current_hp: c.defense,
      max_hp: c.max_defense || c.base_defense,
      // Compatibility for legacy arena.js
      mechanic_name: c.traits.length > 0 ? c.traits[0].name : null,
      mechanic_icon: c.traits.length > 0 ? c.traits[0].icon : ""
    }), "snapshot");
    exchangeData.challengerCard = snapshot(cActive);
    exchangeData.targetCard = snapshot(tActive);
    const atkDmg = activeAttacker.attack;
    const defDmg = activeDefender.attack;
    console.log(`[BATTLE EX] #${exchangeCount}: ${attackerSide === "challenger" ? "Challenger" : "Target"} Attacking!`);
    console.log(`[BATTLE ATK] ${activeAttacker.name} (ATK: ${atkDmg}) -> ${activeDefender.name} (DEF: ${activeDefender.defense})`);
    console.log(`[BATTLE DEF] ${activeDefender.name} (ATK: ${defDmg}) -> ${activeAttacker.name} (DEF: ${activeAttacker.defense})`);
    activeDefender.defense -= atkDmg;
    activeAttacker.defense -= defDmg;
    console.log(`[BATTLE RESULT] ${activeDefender.name} now has ${Math.max(0, activeDefender.defense)} DEF`);
    console.log(`[BATTLE RESULT] ${activeAttacker.name} now has ${Math.max(0, activeAttacker.defense)} DEF`);
    exchangeData.challengerCard = snapshot(cActive);
    exchangeData.targetCard = snapshot(tActive);
    const processDeaths = /* @__PURE__ */ __name((cards, sideLabel) => {
      cards.forEach((card) => {
        if (card.alive && card.defense <= 0) {
          if (card.traits.some((t) => t.name === "reanimate") && !card.reviveUsed) {
            card.defense = 1;
            card.reviveUsed = true;
            exchangeData.events.push({ type: "reanimate", card: card.name, side: sideLabel });
          } else {
            card.defense = 0;
            card.alive = false;
            exchangeData.events.push({ type: "death", card: card.name, side: sideLabel });
          }
        }
      });
    }, "processDeaths");
    const attackerLabel = attackerSide === "challenger" ? "attacker" : "defender";
    const defenderLabel = attackerSide === "challenger" ? "defender" : "attacker";
    processDeaths(attackers, attackerLabel);
    processDeaths(defenders, defenderLabel);
    const handleVampire = /* @__PURE__ */ __name((killer, victim, side) => {
      if (killer.alive && !victim.alive && killer.traits.some((t) => t.name === "vampire")) {
        const heal = Math.floor(victim.max_defense * 0.3);
        const oldDef = killer.defense;
        killer.defense = Math.min(killer.base_defense, killer.defense + heal);
        const actualHeal = killer.defense - oldDef;
        if (actualHeal > 0) {
          exchangeData.events.push({ type: "vampire_heal", amount: actualHeal, card: killer.name, side });
        }
      }
    }, "handleVampire");
    handleVampire(activeAttacker, activeDefender, attackerLabel);
    handleVampire(activeDefender, activeAttacker, defenderLabel);
    recalculateMimics(cCards, exchangeData.events, "challenger");
    recalculateMimics(tCards, exchangeData.events, "target");
    exchangeData.challengerCardAfter = snapshot(cActive);
    exchangeData.targetCardAfter = snapshot(tActive);
    exchangeData.challengerSurvived = cActive.alive;
    exchangeData.targetSurvived = tActive.alive;
    exchanges.push(exchangeData);
    attackerSide = attackerSide === "challenger" ? "target" : "challenger";
  }
  const cAlive = cCards.filter((c) => c.alive).length;
  const tAlive = tCards.filter((c) => c.alive).length;
  return {
    round: roundNum,
    firstAttacker: coinFlip,
    // Who won the coin flip this round
    winner: cAlive > tAlive ? "challenger" : tAlive > cAlive ? "target" : "draw",
    exchanges
  };
}
__name(simulateMatchRound, "simulateMatchRound");
async function grantRandomCard(supabase, userId, userName, creatorId, customMessage, env, options = {}) {
  try {
    const { forcedCardId, forcedRarity, isSilent } = options;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let randomCard = null;
    let selectedRarity = "Common";
    if (forcedCardId) {
      const { data: c, error: cErr } = await supabase.from("cards").select("*").eq("id", forcedCardId).single();
      if (cErr || !c) throw new Error("Forced card not found");
      randomCard = c;
      selectedRarity = c.rarity;
    } else {
      let rarityWeights = null;
      if (forcedRarity) {
        selectedRarity = forcedRarity.charAt(0).toUpperCase() + forcedRarity.slice(1);
      } else {
        const { data: activeEvent } = await supabase.from("streamer_events").select("config").eq("streamer_id", creatorId).eq("is_active", true).lte("starts_at", now).gte("ends_at", now).maybeSingle();
        rarityWeights = activeEvent?.config;
        if (!rarityWeights) {
          const { data: customConfig } = await supabase.from("streamer_rarity_configs").select("common_weight, rare_weight, epic_weight, legendary_weight").eq("streamer_id", creatorId).maybeSingle();
          if (customConfig) {
            rarityWeights = {
              common: customConfig.common_weight,
              rare: customConfig.rare_weight,
              epic: customConfig.epic_weight,
              legendary: customConfig.legendary_weight
            };
          }
        }
        if (!rarityWeights) {
          const { data: configData } = await supabase.from("system_config").select("*");
          rarityWeights = configData?.find((c) => c.id === "rarity_weights")?.data || { common: 70, rare: 20, epic: 8, legendary: 2 };
        }
        const roll = Math.random() * 100;
        let cumulative = 0;
        for (const r of ["common", "rare", "epic", "legendary"]) {
          cumulative += rarityWeights[r] || 0;
          if (roll <= cumulative) {
            selectedRarity = r.charAt(0).toUpperCase() + r.slice(1);
            break;
          }
        }
      }
      const { data: pool } = await supabase.from("cards").select("*").eq("rarity", selectedRarity).eq("streamer_id", creatorId);
      if (!pool || pool.length === 0) {
        if (forcedRarity) {
          const { data: anyPool } = await supabase.from("cards").select("*").eq("streamer_id", creatorId).limit(1);
          if (!anyPool || anyPool.length === 0) throw new Error("No cards available for this streamer");
          randomCard = anyPool[0];
        } else {
          if (selectedRarity !== "Common") return grantRandomCard(supabase, userId, userName, creatorId, customMessage, env, options);
          return;
        }
      } else {
        randomCard = pool[Math.floor(Math.random() * pool.length)];
      }
    }
    const { data: user } = await supabase.from("users").select("is_linked").eq("twitch_id", userId).maybeSingle();
    if (user?.is_linked) {
      const isGenesis = Math.random() < 0.01;
      const primaryMechanicId = await assignMechanic(supabase);
      let secondaryMechanicId = null;
      if (isGenesis) {
        let retries = 0;
        while (retries < 5) {
          secondaryMechanicId = await assignMechanic(supabase);
          if (secondaryMechanicId !== primaryMechanicId) break;
          retries++;
        }
      }
      await supabase.from("user_cards").insert({
        twitch_id: userId,
        card_id: randomCard.id,
        streamer_id: creatorId,
        granted_by_streamer: creatorId,
        is_obs_consumed: isSilent || false,
        attack: randomCard.attack,
        defense: randomCard.defense,
        max_hp: randomCard.defense,
        mechanic_id: isGenesis ? secondaryMechanicId : primaryMechanicId,
        genesis_mechanic_id: isGenesis ? primaryMechanicId : null
      });
      const notificationMsg = isGenesis ? `\u{1F30C} GENESIS CARD! ${customMessage || `You got a dual-trait card: ${randomCard.name}!`}` : customMessage || `\u{1F3F0} You got a new card: ${randomCard.name}!`;
      await supabase.from("notifications").insert({
        twitch_id: userId,
        streamer_id: creatorId,
        type: "card_drop",
        message: notificationMsg,
        data: {
          card_id: randomCard.id,
          name: randomCard.name,
          rarity: randomCard.rarity,
          image_url: randomCard.image_url,
          is_genesis: isGenesis
        }
      });
      await checkAndUnlockAchievements(supabase, userId, randomCard, creatorId);
    } else {
      await supabase.from("pending_rewards").insert({
        twitch_id: userId,
        card_id: randomCard.id,
        streamer_id: creatorId,
        is_obs_consumed: isSilent || false
      });
    }
    if (!user) await supabase.from("users").upsert({ twitch_id: userId, username: userName, is_linked: false }, { onConflict: "twitch_id" });
  } catch (e) {
    console.error("[Grant] Error:", e.message);
  }
}
__name(grantRandomCard, "grantRandomCard");
function secureResponse(data, status, corsHeaders, isError = false) {
  const securityHeaders = {
    ...corsHeaders,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy": "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https: blob:;",
    "Content-Type": "application/json"
  };
  const payload = isError ? { error: data } : data;
  return new Response(JSON.stringify(payload), { status, headers: securityHeaders });
}
__name(secureResponse, "secureResponse");
async function logSystem(supabase, level, category, message2, streamerId, metadata = {}) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const logPrefix = `[${timestamp}] [${category.toUpperCase()}] [${level.toUpperCase()}]`;
  const streamerInfo = streamerId ? ` [${streamerId}]` : "";
  console.log(`${logPrefix}${streamerInfo} ${message2}`, Object.keys(metadata).length ? metadata : "");
}
__name(logSystem, "logSystem");
var rateLimitStore = /* @__PURE__ */ new Map();
function checkRateLimit(ip, limit = 60) {
  const now = Date.now();
  const windowMs = 6e4;
  const record = rateLimitStore.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count++;
  return true;
}
__name(checkRateLimit, "checkRateLimit");
async function checkAndUnlockAchievements(supabase, twitchId, card, streamerId) {
  try {
    console.log("[Achievements] ========== CHECKING ACHIEVEMENTS ==========");
    console.log("[Achievements] User:", twitchId);
    console.log("[Achievements] Streamer:", streamerId);
    console.log("[Achievements] Card:", card.id, card.name, card.rarity);
    const { count: cardCount, error: countError } = await supabase.from("user_cards").select("*", { count: "exact", head: true }).eq("twitch_id", twitchId).eq("streamer_id", streamerId);
    if (countError) {
      console.error("[Achievements] Error getting card count:", countError);
      return;
    }
    console.log("[Achievements] Total cards owned:", cardCount);
    const { data: unlocked, error: unlockedError } = await supabase.from("user_achievements").select("achievement_id").eq("twitch_id", twitchId).eq("streamer_id", streamerId);
    if (unlockedError) {
      console.error("[Achievements] Error getting unlocked achievements:", unlockedError);
      return;
    }
    const unlockedIds = new Set(unlocked?.map((a) => a.achievement_id) || []);
    console.log("[Achievements] Already unlocked:", Array.from(unlockedIds).join(", ") || "none");
    const toUnlock = [];
    if (cardCount === 1 && !unlockedIds.has("first_card")) {
      toUnlock.push("first_card");
      console.log("[Achievements] \u2713 Qualifies for: first_card");
    }
    if (cardCount >= 10 && !unlockedIds.has("collector_10")) {
      toUnlock.push("collector_10");
      console.log("[Achievements] \u2713 Qualifies for: collector_10");
    }
    if (cardCount >= 50 && !unlockedIds.has("collector_50")) {
      toUnlock.push("collector_50");
      console.log("[Achievements] \u2713 Qualifies for: collector_50");
    }
    const rarity = card.rarity?.toLowerCase();
    console.log("[Achievements] Card rarity (lowercase):", rarity);
    if (rarity === "rare" && !unlockedIds.has("rare_finder")) {
      toUnlock.push("rare_finder");
      console.log("[Achievements] \u2713 Qualifies for: rare_finder");
    }
    if (rarity === "epic" && !unlockedIds.has("epic_moment")) {
      toUnlock.push("epic_moment");
      console.log("[Achievements] \u2713 Qualifies for: epic_moment");
    }
    if (rarity === "legendary" && !unlockedIds.has("legendary_luck")) {
      toUnlock.push("legendary_luck");
      console.log("[Achievements] \u2713 Qualifies for: legendary_luck");
    }
    const { count: totalCards } = await supabase.from("cards").select("*", { count: "exact", head: true }).eq("streamer_id", streamerId);
    const { count: uniqueCardsOwned } = await supabase.from("user_cards").select("card_id", { count: "exact", head: true }).eq("twitch_id", twitchId).eq("streamer_id", streamerId);
    console.log("[Achievements] Unique cards owned:", uniqueCardsOwned, "/", totalCards);
    if (uniqueCardsOwned >= totalCards && !unlockedIds.has("completionist")) {
      toUnlock.push("completionist");
      console.log("[Achievements] \u2713 Qualifies for: completionist (ALL CARDS COLLECTED!)");
    }
    if (!unlockedIds.has("set_collector")) {
      const { data: setCounts } = await supabase.from("enriched_user_cards").select("set_id").eq("twitch_id", twitchId).eq("streamer_id", streamerId);
      const distinctSets = new Set(setCounts?.map((c) => c.set_id).filter(Boolean) || []);
      console.log("[Achievements] Distinct sets owned:", distinctSets.size);
      if (distinctSets.size >= 2) {
        toUnlock.push("set_collector");
        console.log("[Achievements] \u2713 Qualifies for: set_collector");
      }
    }
    if (!unlockedIds.has("rarity_streak_3")) {
      const { data: lastPulls } = await supabase.from("enriched_user_cards").select("rarity").eq("twitch_id", twitchId).eq("streamer_id", streamerId).order("created_at", { ascending: false }).limit(3);
      if (lastPulls && lastPulls.length === 3) {
        const streakStats = lastPulls.every((p) => {
          const r = p.rarity?.toLowerCase();
          return r === "rare" || r === "epic" || r === "legendary";
        });
        if (streakStats) {
          toUnlock.push("rarity_streak_3");
          console.log("[Achievements] \u2713 Qualifies for: rarity_streak_3 (HOT STREAK!)");
        }
      }
    }
    if (toUnlock.length > 0) {
      console.log("[Achievements] Unlocking:", toUnlock.join(", "));
      const inserts = toUnlock.map((id) => ({
        twitch_id: twitchId,
        achievement_id: id,
        streamer_id: streamerId
      }));
      const { error: insertError } = await supabase.from("user_achievements").insert(inserts);
      if (insertError) {
        console.error("[Achievements] \u274C Error inserting achievements:", insertError);
      } else {
        console.log("[Achievements] \u2705 Successfully unlocked:", toUnlock.join(", "));
        const notifications = toUnlock.map((id) => ({
          twitch_id: twitchId,
          streamer_id: streamerId,
          type: "achievement_unlock",
          message: `\u{1F3C6} Achievement Unlocked: ${id.replace(/_/g, " ").toUpperCase()}!`,
          data: { achievement_id: id }
        }));
        await supabase.from("notifications").insert(notifications);
      }
    } else {
      console.log("[Achievements] No new achievements to unlock");
    }
    console.log("[Achievements] ==========================================");
  } catch (e) {
    console.error("[Achievements] \u274C CRITICAL ERROR:", e);
  }
}
__name(checkAndUnlockAchievements, "checkAndUnlockAchievements");
async function syncUserAchievements(supabase, twitchId, streamerId) {
  try {
    console.log(`[Achievements] Starting full sync for user ${twitchId} on streamer ${streamerId}`);
    const { data: userCards, error: cardsError } = await supabase.from("user_cards").select("card_id, attack, defense, cards(rarity, set_id)").eq("twitch_id", twitchId).eq("streamer_id", streamerId);
    if (cardsError || !userCards) {
      console.error("[Achievements] Sync failed: error fetching cards", cardsError);
      return { success: false, error: "Failed to fetch cards" };
    }
    const cardCount = userCards.length;
    if (cardCount === 0) return { success: true, count: 0 };
    const { data: unlocked } = await supabase.from("user_achievements").select("achievement_id").eq("twitch_id", twitchId).eq("streamer_id", streamerId);
    const unlockedIds = new Set(unlocked?.map((a) => a.achievement_id) || []);
    const toUnlock = [];
    if (cardCount >= 1 && !unlockedIds.has("first_card")) toUnlock.push("first_card");
    if (cardCount >= 10 && !unlockedIds.has("collector_10")) toUnlock.push("collector_10");
    if (cardCount >= 50 && !unlockedIds.has("collector_50")) toUnlock.push("collector_50");
    const rarities = new Set(userCards.map((c) => c.cards?.rarity?.toLowerCase()));
    if (rarities.has("rare") && !unlockedIds.has("rare_finder")) toUnlock.push("rare_finder");
    if (rarities.has("epic") && !unlockedIds.has("epic_moment")) toUnlock.push("epic_moment");
    if (rarities.has("legendary") && !unlockedIds.has("legendary_luck")) toUnlock.push("legendary_luck");
    if (!unlockedIds.has("set_collector")) {
      const distinctSets = new Set(userCards.map((c) => c.cards?.set_id).filter(Boolean));
      if (distinctSets.size >= 2) toUnlock.push("set_collector");
    }
    if (!unlockedIds.has("completionist")) {
      const { count: totalCardsInPool } = await supabase.from("cards").select("*", { count: "exact", head: true }).eq("streamer_id", streamerId);
      const uniqueOwned = new Set(userCards.map((c) => c.card_id)).size;
      if (uniqueOwned >= (totalCardsInPool || 999)) toUnlock.push("completionist");
    }
    if (!unlockedIds.has("rarity_streak_3")) {
      const { data: last3 } = await supabase.from("user_cards").select("cards(rarity)").eq("twitch_id", twitchId).eq("streamer_id", streamerId).order("created_at", { ascending: false }).limit(3);
      if (last3?.length === 3 && last3.every((c) => ["rare", "epic", "legendary"].includes(c.cards?.rarity?.toLowerCase()))) {
        toUnlock.push("rarity_streak_3");
      }
    }
    if (toUnlock.length > 0) {
      console.log(`[Achievements] Sync unlocking ${toUnlock.length} items for ${twitchId}`);
      const inserts = toUnlock.map((id) => ({
        twitch_id: twitchId,
        achievement_id: id,
        streamer_id: streamerId
      }));
      await supabase.from("user_achievements").insert(inserts);
      const notifications = toUnlock.map((id) => ({
        twitch_id: twitchId,
        streamer_id: streamerId,
        type: "achievement_unlock",
        message: `\u{1F3C6} Retroactive Unlock: ${id.replace(/_/g, " ").toUpperCase()}!`,
        data: { achievement_id: id, is_retro: true }
      }));
      await supabase.from("notifications").insert(notifications);
    }
    return { success: true, unlocked: toUnlock };
  } catch (e) {
    console.error("[Achievements] Sync exception:", e);
    return { success: false, error: "Exception during sync" };
  }
}
__name(syncUserAchievements, "syncUserAchievements");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname.replace(/\/$/, "") || "/";
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const origin = request.headers.get("Origin") || "";
    const domainMatch = env.FRONTEND_URL ? new URL(env.FRONTEND_URL).hostname.replace("www.", "") : "";
    const isAllowedOrigin = origin === env.FRONTEND_URL || domainMatch && origin.includes(domainMatch) || origin === "http://localhost:8787" || origin === "http://localhost:3000" || origin.endsWith(".workers.dev");
    const corsHeaders = {
      "Access-Control-Allow-Origin": isAllowedOrigin ? origin : env.FRONTEND_URL,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Twitch-ID, X-CSRF-Token"
    };
    if (method === "GET" && path === "/api/mechanics") {
      const { data, error } = await supabase.from("mechanics").select("*");
      if (error) return secureResponse("Failed to fetch mechanics", 500, corsHeaders, true);
      return secureResponse(data, 200, corsHeaders);
    }
    try {
      async function checkAdmin(req) {
        const cookie = req.headers.get("Cookie");
        const token = cookie?.match(/admin_session=([^;]+)/)?.[1];
        if (!token) {
          throw new Error("Unauthorized: Session missing");
        }
        try {
          const { payload } = await jwtVerify(token, new TextEncoder().encode(env.ADMIN_SECRET), {
            issuer: "mulistreamer-tcg-admin",
            audience: "mulistreamer-tcg-admin-panel"
          });
          if (payload.admin !== true) {
            throw new Error("Unauthorized: Insufficient privileges");
          }
          return;
        } catch (e) {
          throw new Error("Unauthorized: Invalid session");
        }
      }
      __name(checkAdmin, "checkAdmin");
      async function checkCreator(req, sbase) {
        const u = await getUserFromSession(req, env, sbase);
        if (!u) throw new Error("Unauthorized");
        console.log("[checkCreator] Checking for creator with twitch_id:", u.twitch_id);
        let { data: s, error: streamerError } = await sbase.from("streamers").select("*, obs_overlay_token").eq("twitch_id", u.twitch_id).maybeSingle();
        if (streamerError) {
          console.error("[checkCreator] Database error:", streamerError);
          throw new Error("Database error: " + streamerError.message);
        }
        if (!s) {
          console.log("[checkCreator] No streamer found, auto-onboarding user:", u.username);
          try {
            const { data: newStreamer, error: onboardErr } = await sbase.from("streamers").insert({
              twitch_id: u.twitch_id,
              username: u.username.toLowerCase(),
              display_name: u.username,
              brand_name: u.username || "My Collection",
              avatar_url: u.avatar_url,
              is_active: false
            }).select("*, obs_overlay_token").single();
            if (onboardErr) {
              if (onboardErr.code === "23505" || onboardErr.message?.includes("duplicate")) {
                const { data: existing } = await sbase.from("streamers").select("*, obs_overlay_token").eq("twitch_id", u.twitch_id).maybeSingle();
                if (existing) s = existing;
                else throw new Error("Failed to auto-onboard: " + onboardErr.message);
              } else {
                throw new Error("Failed to auto-onboard: " + onboardErr.message);
              }
            } else if (newStreamer) {
              s = newStreamer;
            }
          } catch (onboardException) {
            throw new Error("Not a registered creator. Auto-onboard failed: " + (onboardException.message || "Unknown error"));
          }
        }
        if (!s) throw new Error("Not a registered creator");
        return { user: u, streamer: s };
      }
      __name(checkCreator, "checkCreator");
      console.log(`[Request] ${method} ${url.pathname}`);
      console.log(`[CORS] Origin: ${origin || "none"}, Allowed: ${isAllowedOrigin}, Final: ${corsHeaders["Access-Control-Allow-Origin"]}`);
      const cookieHeader = request.headers.get("Cookie") || "";
      console.log(`[Cookies] ${cookieHeader ? "Header present (" + cookieHeader.split(";").length + " items)" : "Header missing"}`);
      if (method === "OPTIONS") return new Response(null, { headers: corsHeaders });
      if (method === "GET" && path === "/obs-overlay") {
        const streamerParam = url.searchParams.get("streamer");
        const tokenParam = url.searchParams.get("token");
        if (!streamerParam || !tokenParam) {
          return new Response("Missing streamer or token parameter", {
            status: 400,
            headers: { "Content-Type": "text/html" }
          });
        }
        console.log("[OBS Overlay] Looking for streamer:", streamerParam);
        let { data: streamerData, error: streamerError } = await supabase.from("streamers").select("id, username, obs_overlay_token").ilike("username", streamerParam).maybeSingle();
        if (!streamerData) {
          console.log("[OBS Overlay] Not found with ilike, trying lowercase:", streamerParam.toLowerCase());
          const { data: lowerData, error: lowerError } = await supabase.from("streamers").select("id, username, obs_overlay_token").eq("username", streamerParam.toLowerCase()).maybeSingle();
          if (lowerData) {
            streamerData = lowerData;
            streamerError = lowerError;
          }
        }
        if (!streamerData) {
          console.log("[OBS Overlay] Not found with lowercase, trying exact match");
          const { data: exactData, error: exactError } = await supabase.from("streamers").select("id, username, obs_overlay_token").eq("username", streamerParam).maybeSingle();
          if (exactData) {
            streamerData = exactData;
            streamerError = exactError;
          }
        }
        const streamer = streamerData;
        if (streamer) {
          console.log("[OBS Overlay] Found streamer:", streamer.username, "ID:", streamer.id);
        } else {
          console.error("[OBS Overlay] Streamer not found after all attempts. Searched for:", streamerParam);
        }
        if (streamerError) {
          console.error("[OBS Overlay] Database error:", streamerError);
          return new Response(`
          <!DOCTYPE html>
          <html>
            <head><title>Database Error</title></head>
            <body style="background:rgba(0,0,0,.9);color:white;padding:24px;font-family:sans-serif">
              <h1>\u26A0\uFE0F Database Error</h1>
              <p>Error: ${streamerError.message}</p>
              <p>Code: ${streamerError.code || "unknown"}</p>
            </body>
          </html>
        `, {
            status: 500,
            headers: { "Content-Type": "text/html" }
          });
        }
        if (!streamer) {
          console.error("[OBS Overlay] Streamer not found:", streamerParam);
          return new Response(`
          <!DOCTYPE html>
          <html>
            <head><title>Streamer Not Found</title></head>
            <body style="background:rgba(0,0,0,.9);color:white;padding:24px;font-family:sans-serif">
              <h1>\u26D4 Streamer Not Found</h1>
              <p>Streamer "${streamerParam}" not found in database.</p>
            </body>
          </html>
        `, {
            status: 404,
            headers: { "Content-Type": "text/html" }
          });
        }
        const storedToken = (streamer.obs_overlay_token || "").trim();
        const providedToken = (tokenParam || "").trim();
        console.log("[OBS Overlay] Streamer:", streamer.username);
        console.log("[OBS Overlay] Stored token exists:", !!storedToken);
        console.log("[OBS Overlay] Stored token (first 8):", storedToken.substring(0, 8));
        console.log("[OBS Overlay] Provided token (first 8):", providedToken.substring(0, 8));
        console.log("[OBS Overlay] Tokens match:", storedToken === providedToken);
        if (!storedToken || storedToken !== providedToken) {
          console.error("[OBS Overlay] Token mismatch!");
          console.error("[OBS Overlay] Stored token length:", storedToken.length);
          console.error("[OBS Overlay] Provided token length:", providedToken.length);
          return new Response(`
          <!DOCTYPE html>
          <html>
            <head><title>Access Denied</title></head>
            <body style="background:rgba(0,0,0,.9);color:white;padding:24px;font-family:sans-serif">
              <h1>\u26D4 Access Denied</h1>
              <p>Invalid token. Please regenerate your overlay URL from the creator dashboard.</p>
              <p style="font-size:12px;color:#888;margin-top:20px;">
                Debug: Streamer found: ${!!streamer}, Token exists: ${!!storedToken}, Token length: ${storedToken.length}
              </p>
            </body>
          </html>
        `, {
            status: 403,
            headers: { "Content-Type": "text/html" }
          });
        }
        try {
          const obsRes = await env.ASSETS?.fetch(new Request(`${url.origin}/obs.html`));
          if (obsRes && obsRes.ok) {
            return new Response(obsRes.body, {
              headers: {
                "Content-Type": "text/html",
                ...corsHeaders
              }
            });
          }
        } catch (e) {
          console.error("[OBS Overlay] Error:", e);
        }
        return new Response("OBS overlay not found", { status: 404 });
      }
      if (env.ASSETS && !path.startsWith("/api") && !path.startsWith("/auth") && path !== "/twitch/eventsub" && !path.startsWith("/api/obs") && path !== "/obs-overlay") {
        try {
          const assetRes = await env.ASSETS.fetch(request.clone());
          if (assetRes.status !== 404) return assetRes;
          if (method === "GET") {
            const indexRes = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`));
            if (indexRes.ok) return indexRes;
          }
        } catch (e) {
          console.error("[Assets] Error:", e);
        }
      }
      const requiredSecrets = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_KEY",
        "TWITCH_CLIENT_ID",
        "FRONTEND_URL",
        "ADMIN_PASSWORD",
        "SESSION_SECRET",
        "ADMIN_SECRET"
      ];
      const missing = requiredSecrets.filter((s) => !env[s]);
      if (missing.length > 0) {
        return secureResponse(`Missing secrets: ${missing.join(", ")}`, 500, {}, true);
      }
      const clientIP = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
      const isAdminRoute = path.startsWith("/api/admin");
      const isAdminLogin = method === "POST" && path === "/api/admin/login";
      const rateLimit = isAdminLogin ? 10 : isAdminRoute ? 600 : 300;
      if (!checkRateLimit(clientIP, rateLimit)) {
        return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
          status: 429,
          headers: { ...corsHeaders, "Retry-After": "60" }
        });
      }
      if (path === "/api/me") {
        console.log(`[Auth/Me] Request from: ${request.headers.get("Origin") || "no-origin"}, Host: ${request.headers.get("Host")}`);
        try {
          const user = await getUserFromSession(request, env, supabase);
          if (!user) {
            console.warn(`[Auth/Me] Session invalid or user not found`);
            return secureResponse("Unauthorized", 401, corsHeaders, true);
          }
          const { data: streamer } = await supabase.from("streamers").select("id").eq("twitch_id", user.twitch_id).maybeSingle();
          console.log(`[Auth/Me] Session verified for: ${user.username}`);
          return secureResponse({ ...user, is_creator: !!streamer }, 200, corsHeaders);
        } catch (e) {
          console.error(`[Auth/Me] Error: ${e.message}`);
          return secureResponse("Unauthorized", 401, corsHeaders, true);
        }
      }
      if (path === "/api/bootstrap") {
        try {
          const user = await getUserFromSession(request, env, supabase);
          const streamerParam = url.searchParams.get("streamer") || url.searchParams.get("streamer_id");
          const isGlobal = streamerParam === "all";
          const streamer = isGlobal ? { id: "all", username: "all", display_name: "Creator Hub", brand_name: "Global" } : await resolveStreamerContext(request, supabase, url);
          if (!streamer) {
            return secureResponse("Streamer context not found", 404, corsHeaders, true);
          }
          let creatorRecord = null;
          if (user) {
            const { data } = await supabase.from("streamers").select("*").eq("twitch_id", user.twitch_id).maybeSingle();
            creatorRecord = data;
          }
          const fetchPromises = [];
          const targetTwitchId = user?.twitch_id;
          if (targetTwitchId) {
            let totalQuery = supabase.from("user_cards").select("*", { count: "exact", head: true }).eq("twitch_id", targetTwitchId);
            let legendaryQuery = supabase.from("user_cards").select("*, cards!inner(rarity)", { count: "exact", head: true }).eq("twitch_id", targetTwitchId);
            if (!isGlobal) {
              totalQuery = totalQuery.eq("streamer_id", streamer.id);
              legendaryQuery = legendaryQuery.eq("streamer_id", streamer.id);
            }
            legendaryQuery = legendaryQuery.or("rarity.ilike.legendary", { foreignTable: "cards" });
            fetchPromises.push(totalQuery);
            fetchPromises.push(legendaryQuery);
          } else {
            fetchPromises.push(Promise.resolve({ count: 0 }));
            fetchPromises.push(Promise.resolve({ count: 0 }));
          }
          if (targetTwitchId) {
            let dropsQuery = supabase.from("enriched_user_cards").select("*").eq("twitch_id", targetTwitchId);
            if (!isGlobal) dropsQuery = dropsQuery.eq("streamer_id", streamer.id);
            fetchPromises.push(dropsQuery.order("created_at", { ascending: false }).limit(12));
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
          }
          if (targetTwitchId) {
            fetchPromises.push(supabase.from("user_binders").select("*").eq("user_id", targetTwitchId).order("sort_order", { ascending: true }));
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
          }
          if (targetTwitchId) {
            let achQuery = supabase.from("user_achievements").select("achievement_id, achieved_at");
            if (!isGlobal) achQuery = achQuery.eq("streamer_id", streamer.id);
            fetchPromises.push(achQuery.eq("twitch_id", targetTwitchId));
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
          }
          let lbQuery = supabase.from("streamer_leaderboards").select("*");
          if (!isGlobal) lbQuery = lbQuery.eq("streamer_id", streamer.id);
          fetchPromises.push(lbQuery.order("total_cards", { ascending: false }).limit(100));
          let availQuery = supabase.from("cards").select("*", { count: "exact", head: true });
          if (!isGlobal) availQuery = availQuery.eq("streamer_id", streamer.id);
          fetchPromises.push(availQuery);
          if (creatorRecord) {
            fetchPromises.push(supabase.from("cards").select("*").eq("streamer_id", creatorRecord.id).order("created_at", { ascending: false }).limit(50));
            fetchPromises.push(supabase.from("streamer_leaderboards").select("*").eq("streamer_id", creatorRecord.id).maybeSingle());
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
            fetchPromises.push(Promise.resolve({ data: null }));
          }
          if (targetTwitchId) {
            fetchPromises.push(supabase.from("user_favorites").select("streamer_id").eq("user_id", targetTwitchId));
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
          }
          if (targetTwitchId) {
            fetchPromises.push(supabase.from("enriched_user_cards").select("streamer_id, brand_name, streamer_username, avatar_url, pack_image_url").eq("twitch_id", targetTwitchId));
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
          }
          fetchPromises.push(supabase.from("streamers").select("id, username, display_name, avatar_url, brand_name, is_active").eq("is_active", true).limit(20));
          fetchPromises.push(supabase.from("achievements").select("*"));
          const [
            statsTotalRes,
            statsLegendaryRes,
            recentDropsRes,
            bindersRes,
            achievementsRes,
            leaderboardRes,
            totalAvailRes,
            creatorCardsRes,
            creatorStatsRes,
            favoritesRes,
            personalConnectionsRes,
            activeStreamersRes,
            allAvailableAchievementsRes
          ] = await Promise.all(fetchPromises);
          const leaderboard = leaderboardRes.data || [];
          const csrfToken = crypto.randomUUID();
          const isHttps = request.url.startsWith("https");
          const secureFlag = isHttps ? "; Secure" : "";
          const collectedMap = /* @__PURE__ */ new Map();
          (personalConnectionsRes.data || []).forEach((c) => {
            if (!collectedMap.has(c.streamer_id)) {
              collectedMap.set(c.streamer_id, {
                id: c.streamer_id,
                username: c.streamer_username,
                display_name: c.brand_name || c.streamer_username,
                avatar_url: c.avatar_url,
                brand_name: c.brand_name,
                brand_logo_url: c.pack_image_url,
                is_active: true
              });
            }
          });
          const favoriteIds = new Set((favoritesRes.data || []).map((f) => f.streamer_id));
          const favorites = [];
          let followedStreamers = [];
          let debugFollowsCount = 0;
          let debugTokenValid = false;
          let debugFollowsRawIds = "";
          let debugAllStreamerIds = "";
          let debugAllStreamersDetail = "";
          let debugStreamersError = "";
          let debugMatchSource = "none";
          let debugMatchDetails = "";
          const { data: allS, error: allStreamersErr } = await supabase.from("streamers").select("id, username, display_name, avatar_url, brand_name, brand_tagline, binder_color, is_active, twitch_id");
          if (allStreamersErr) {
            debugStreamersError = `${allStreamersErr.code}: ${allStreamersErr.message}`;
            console.error("[Bootstrap/Twitch] streamers query failed:", allStreamersErr.message, allStreamersErr.code);
          }
          const allStreamersList = allS || [];
          debugAllStreamerIds = allStreamersList.map((s) => s.twitch_id).join(",");
          debugAllStreamersDetail = allStreamersList.map((s) => `${s.username}:${s.twitch_id ?? "null"}`).slice(0, 20).join("; ");
          if (allStreamersList.length === 0) {
            console.warn("[Bootstrap/Twitch] No streamers in DB - cannot match follows. Run migrations?");
          }
          if (user && path === "/api/bootstrap") {
            const { data: fullUser } = await supabase.from("users").select("twitch_access_token_encrypted").eq("twitch_id", user.twitch_id).single();
            if (fullUser?.twitch_access_token_encrypted) {
              let accessToken = "";
              try {
                accessToken = await decryptSensitive(fullUser.twitch_access_token_encrypted, env.SESSION_SECRET);
                debugTokenValid = true;
                console.log(`[Bootstrap/Twitch] Fetching follows for ${user.twitch_id}...`);
                const follows = await getTwitchFollows(user.twitch_id, accessToken, env.TWITCH_CLIENT_ID);
                debugFollowsCount = follows.length;
                if (follows.length > 0) {
                  const followTwitchIds = follows.map((f) => String(f.broadcaster_id ?? "").replace(/\D/g, "")).filter((id) => id.length > 0);
                  const followLogins = follows.map((f) => (f.broadcaster_login || "").toLowerCase()).filter(Boolean);
                  debugFollowsRawIds = followTwitchIds.join(",");
                  const matchDebug = [];
                  followedStreamers = allStreamersList.filter((s) => {
                    if (!s.twitch_id) return false;
                    const dbId = String(s.twitch_id).trim().replace(/\D/g, "");
                    const isMatch = followTwitchIds.includes(dbId);
                    matchDebug.push(`${s.username}:twitch_id=${s.twitch_id} dbId=${dbId} match=${isMatch}`);
                    return isMatch;
                  });
                  const alreadyMatched = new Set(followedStreamers.map((s) => s.id));
                  for (const s of allStreamersList) {
                    if (alreadyMatched.has(s.id)) continue;
                    const login = (s.username || "").toLowerCase();
                    if (login && followLogins.includes(login)) {
                      followedStreamers.push(s);
                      alreadyMatched.add(s.id);
                      matchDebug.push(`${s.username}:by_login`);
                    }
                  }
                  debugMatchSource = followedStreamers.length > 0 ? "js_match_success" : "js_match_fail";
                  debugMatchDetails = matchDebug.slice(0, 8).join("; ");
                  console.log(`[Twitch Match] Twitch IDs: ${followTwitchIds.join(",")}; Logins: ${followLogins.slice(0, 5).join(",")}`);
                  console.log(`[Twitch Match] Platform Matches: ${followedStreamers.length}`);
                }
              } catch (tokenErr) {
                console.error("[Bootstrap/Twitch] Token handling or fetch failed:", tokenErr);
              }
            }
          }
          const discoveryStreamers = activeStreamersRes.data || [];
          const allStreamersMap = /* @__PURE__ */ new Map();
          discoveryStreamers.forEach((s) => allStreamersMap.set(s.id, s));
          collectedMap.forEach((s, id) => allStreamersMap.set(id, s));
          followedStreamers.forEach((s) => allStreamersMap.set(s.id, s));
          const missingFavoriteIds = Array.from(favoriteIds).filter((id) => !allStreamersMap.has(id));
          if (missingFavoriteIds.length > 0) {
            const { data: resolvedFavs } = await supabase.from("streamers").select("id, username, display_name, avatar_url, brand_name, brand_tagline, binder_color, is_active").in("id", missingFavoriteIds);
            if (resolvedFavs) {
              resolvedFavs.forEach((s) => {
                allStreamersMap.set(s.id, s);
              });
            }
          }
          favoriteIds.forEach((id) => {
            const s = allStreamersMap.get(id);
            if (s) favorites.push(s);
          });
          const sections = {
            favorites,
            collected: Array.from(collectedMap.values()),
            followed: followedStreamers.filter((s) => !favoriteIds.has(s.id)),
            // Don't duplicate in followed if favorited
            discovery: discoveryStreamers.filter((s) => !favoriteIds.has(s.id) && !collectedMap.has(s.id))
          };
          console.log(`[DEBUG] Bootstrap for ${user?.username || "Guest"}`);
          console.log(`[DEBUG]   Favorites: ${sections.favorites.length}`);
          console.log(`[DEBUG]   Collected: ${sections.collected.length}`);
          console.log(`[DEBUG]   Followed: ${sections.followed.length}`);
          console.log(`[DEBUG]   Discovery: ${sections.discovery.length}`);
          console.log(`[DEBUG]   CreatorRecord: ${creatorRecord ? "YES" : "NO"} (Active: ${creatorRecord?.is_active})`);
          if (creatorRecord && creatorRecord.is_active) {
            const inFavorites = sections.favorites.some((s) => s.id === creatorRecord.id);
            const inCollected = sections.collected.some((s) => s.id === creatorRecord.id);
            const existingInDiscovery = sections.discovery.find((s) => s.id === creatorRecord.id);
            if (inFavorites || inCollected) {
            } else if (existingInDiscovery) {
              existingInDiscovery.is_self = true;
            } else {
              sections.discovery.unshift({
                id: creatorRecord.id,
                username: creatorRecord.username,
                display_name: creatorRecord.display_name,
                avatar_url: creatorRecord.avatar_url,
                brand_name: creatorRecord.brand_name,
                brand_logo_url: creatorRecord.avatar_url,
                is_active: true,
                is_self: true
              });
            }
          }
          return secureResponse({
            user: user ? { ...user, is_creator: !!creatorRecord, streamer: creatorRecord } : null,
            streamer,
            active_streamers: discoveryStreamers,
            // Legacy support
            sections,
            favorite_ids: Array.from(favoriteIds),
            stats: {
              total: statsTotalRes.count || 0,
              legendary: statsLegendaryRes.count || 0,
              total_available: totalAvailRes.count || 0
            },
            recent_drops: recentDropsRes.data || [],
            binders: bindersRes.data || [],
            achievements: (() => {
              const customNames = streamer.achievement_names || {};
              const idToKeyMap = {
                "first_card": "beginner",
                "collector_10": "hoarder",
                "rare_finder": "rare",
                "epic_moment": "epic",
                "legendary_luck": "legendary",
                "completionist": "completionist",
                "set_collector": "traveler",
                "rarity_streak_3": "streak",
                "trader_debut": "trader"
              };
              const unlockedData = achievementsRes.data || [];
              const unlockedIds = new Set(unlockedData.map((a) => a.achievement_id));
              return (allAvailableAchievementsRes.data || []).map((ach) => {
                const customKey = idToKeyMap[ach.id];
                const customName = customKey ? customNames[customKey] : null;
                return {
                  ...ach,
                  name: customName || ach.name,
                  unlocked: unlockedIds.has(ach.id),
                  unlocked_at: unlockedData.find((a) => a.achievement_id === ach.id)?.achieved_at
                };
              });
            })(),
            leaderboard,
            creator_cards: creatorCardsRes.data || [],
            creator_stats: creatorStatsRes.data || null,
            csrf_token: csrfToken
          }, 200, {
            ...corsHeaders,
            "x-debug-supabase-host": (() => {
              try {
                return new URL(env.SUPABASE_URL).hostname;
              } catch {
                return "unknown";
              }
            })(),
            "x-debug-follows-raw-count": debugFollowsCount.toString(),
            "x-debug-follows-raw-ids": debugFollowsRawIds || "none",
            "x-debug-all-streamers": debugAllStreamerIds || "none",
            "x-debug-streamers-detail": debugAllStreamersDetail || "none",
            ...debugStreamersError ? { "x-debug-streamers-error": debugStreamersError } : {},
            "x-debug-follows-platform-matches": followedStreamers.length.toString(),
            "x-debug-token-valid": debugTokenValid.toString(),
            "x-debug-match-source": debugMatchSource,
            "x-debug-match-details": debugMatchDetails || "none",
            "x-debug-favorite-ids": Array.from(favoriteIds).join(","),
            "Set-Cookie": `csrf=${csrfToken}${secureFlag}; SameSite=Lax; Path=/`
          });
        } catch (e) {
          console.error("[Bootstrap] Error:", e);
          return secureResponse("Bootstrap failed", 500, corsHeaders, true);
        }
      }
      if (path === "/api/logout") {
        const isHttps = request.url.startsWith("https");
        const secureFlag = isHttps ? "; Secure" : "";
        return new Response("OK", {
          headers: {
            ...corsHeaders,
            "Set-Cookie": `session=; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
          }
        });
      }
      if (method !== "GET" && path.startsWith("/api") && path !== "/api/logout" && path !== "/api/csrf" && path !== "/api/admin/login" && path !== "/api/admin/logout" && path !== "/twitch/eventsub" && !path.startsWith("/api/obs")) {
        const cookie = request.headers.get("Cookie") || "";
        const csrfCookie = cookie.match(/csrf=([^;]+)/)?.[1];
        const csrfHeader = request.headers.get("X-CSRF-Token");
        if (!csrfCookie || csrfCookie !== csrfHeader) {
          console.warn(`[CSRF] Blocked: Cookie: ${!!csrfCookie}, Header: ${!!csrfHeader}`);
          return secureResponse("CSRF blocked", 403, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/csrf") {
        const token = crypto.randomUUID();
        const isHttps = request.url.startsWith("https");
        const secureFlag = isHttps ? "; Secure" : "";
        return secureResponse({ token }, 200, {
          "Set-Cookie": `csrf=${token}${secureFlag}; SameSite=Lax; Path=/`
        });
      }
      if (path === "/api/onboarding/status") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const { data: streamer } = await supabase.from("streamers").select("*").eq("twitch_id", user.twitch_id).maybeSingle();
        return secureResponse({
          user,
          streamer,
          step: streamer ? streamer.onboarding_step || 1 : 1
        }, 200, corsHeaders);
      }
      if (path === "/api/onboarding/collector/status") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const { data: userData, error } = await supabase.from("users").select("onboarding_collector_step, is_onboarding_complete").eq("twitch_id", user.twitch_id).single();
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse(userData, 200, corsHeaders);
      }
      if (method === "GET" && path === "/api/onboarding/collector/follows") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const { data: dbUser } = await supabase.from("users").select("twitch_access_token_encrypted").eq("twitch_id", user.twitch_id).single();
        if (!dbUser?.twitch_access_token_encrypted) {
          return secureResponse("Twitch token not found", 400, corsHeaders, true);
        }
        try {
          let accessToken = "";
          try {
            accessToken = await decryptSensitive(dbUser.twitch_access_token_encrypted, env.SESSION_SECRET);
          } catch (decryptErr) {
            console.error("[Onboarding/Follows] Decryption failed:", decryptErr);
            return secureResponse("Failed to decrypt token", 500, corsHeaders, true);
          }
          const followsRes = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${user.twitch_id}`, {
            headers: {
              "Client-ID": env.TWITCH_CLIENT_ID,
              "Authorization": `Bearer ${accessToken}`
            }
          });
          if (!followsRes.ok) {
            const err = await followsRes.json();
            throw new Error(`Twitch API Error: ${JSON.stringify(err)}`);
          }
          const followsData = await followsRes.json();
          const followedIds = followsData.data.map((f) => f.broadcaster_id);
          if (followedIds.length === 0) {
            return secureResponse([], 200, corsHeaders);
          }
          const { data: streamers, error: sErr } = await supabase.from("streamers").select("id, username, display_name, avatar_url, brand_name, brand_tagline, is_active").in("twitch_id", followedIds);
          if (sErr) throw sErr;
          const { data: favorites } = await supabase.from("user_favorites").select("streamer_id").eq("user_id", user.twitch_id);
          const favoriteIds = new Set((favorites || []).map((f) => f.streamer_id));
          const enhancedStreamers = (streamers || []).map((s) => ({
            ...s,
            is_favorited: favoriteIds.has(s.id)
          }));
          if (enhancedStreamers.length === 0) {
            console.log("[Onboarding/Follows] No follows on platform, returning all active creators for discovery support");
            const { data: allActive } = await supabase.from("streamers").select("id, username, display_name, avatar_url, brand_name, brand_tagline, is_active").eq("is_active", true).limit(20);
            return secureResponse((allActive || []).map((s) => ({ ...s, is_favorited: favoriteIds.has(s.id) })), 200, corsHeaders);
          }
          return secureResponse(enhancedStreamers, 200, corsHeaders);
        } catch (e) {
          console.error("[Onboarding/Follows] Error:", e);
          return secureResponse(e.message || "Failed to fetch follows", 500, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/onboarding/collector/complete") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const { error } = await supabase.from("users").update({ is_onboarding_complete: true, onboarding_collector_step: 3 }).eq("twitch_id", user.twitch_id);
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/onboarding/collector/step") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const body = await request.json();
        const { error } = await supabase.from("users").update({ onboarding_collector_step: body.step }).eq("twitch_id", user.twitch_id);
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/onboarding/identity") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const body = await request.json();
        if (!body.brand_name) return secureResponse("Brand name required", 400, corsHeaders, true);
        const { data: existing } = await supabase.from("streamers").select("obs_overlay_token").eq("twitch_id", user.twitch_id).maybeSingle();
        const token = existing?.obs_overlay_token || crypto.randomUUID().replace(/-/g, "");
        const { data: streamer, error } = await supabase.from("streamers").upsert({
          twitch_id: user.twitch_id,
          username: user.username.toLowerCase(),
          display_name: user.username,
          avatar_url: user.avatar_url,
          brand_name: body.brand_name,
          brand_tagline: body.brand_tagline,
          binder_color: body.binder_color || "#00ffcc",
          battles_enabled: body.battles_enabled !== void 0 ? body.battles_enabled : true,
          trading_enabled: body.trading_enabled !== void 0 ? body.trading_enabled : true,
          onboarding_step: 4,
          obs_overlay_token: token
        }, { onConflict: "twitch_id" }).select().single();
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse(streamer, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/onboarding/tos") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const body = await request.json();
        const { error } = await supabase.from("streamers").update({ tos_accepted: body.accepted, onboarding_step: 3 }).eq("twitch_id", user.twitch_id);
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/onboarding/obs-style") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const body = await request.json();
        const { error } = await supabase.from("streamers").update({ pack_animation_style: body.pack_style, onboarding_step: 9 }).eq("twitch_id", user.twitch_id);
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/onboarding/collection-methods") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const body = await request.json();
        const { error: collErr } = await supabase.from("streamers").update({ collection_methods: body.methods, onboarding_step: 6 }).eq("twitch_id", user.twitch_id);
        if (collErr) return secureResponse(collErr.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/onboarding/step") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const body = await request.json();
        const { error } = await supabase.from("streamers").update({ onboarding_step: body.step }).eq("twitch_id", user.twitch_id);
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/onboarding/reset-test") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        await supabase.from("streamers").update({
          onboarding_step: 1,
          is_active: false,
          tos_accepted: false,
          collection_methods: {}
        }).eq("twitch_id", user.twitch_id);
        const { error: userError } = await supabase.from("users").update({
          onboarding_collector_step: 1,
          is_onboarding_complete: false
        }).eq("twitch_id", user.twitch_id);
        if (userError) return secureResponse(userError.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/onboarding/achievements") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const body = await request.json();
          const { data, error } = await supabase.from("streamers").update({ achievement_names: body.achievement_names }).eq("id", streamer.id).select().single();
          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/onboarding/activate") {
        const { user, streamer } = await checkCreator(request, supabase);
        const { error } = await supabase.from("streamers").update({ is_active: true }).eq("id", streamer.id);
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/favorites/toggle") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const body = await request.json();
        if (!body.streamer_id) return secureResponse("Streamer ID required", 400, corsHeaders, true);
        const { data: existing } = await supabase.from("user_favorites").select("id").eq("user_id", user.twitch_id).eq("streamer_id", body.streamer_id).maybeSingle();
        if (existing) {
          console.log(`[Favorites] Unfavoriting for user ${user.twitch_id}, streamer ${body.streamer_id}`);
          const { error } = await supabase.from("user_favorites").delete().eq("id", existing.id);
          if (error) {
            console.error("[Favorites] Delete error:", error);
            return secureResponse(error.message, 500, corsHeaders, true);
          }
          return secureResponse({ success: true, favorited: false }, 200, corsHeaders);
        } else {
          console.log(`[Favorites] Favoriting for user ${user.twitch_id}, streamer ${body.streamer_id}`);
          const { error } = await supabase.from("user_favorites").insert({
            user_id: user.twitch_id,
            streamer_id: body.streamer_id
          });
          if (error) {
            console.error("[Favorites] Insert error:", error);
            return secureResponse(error.message, 500, corsHeaders, true);
          }
          return secureResponse({ success: true, favorited: true }, 200, corsHeaders);
        }
      }
      if (method === "GET" && path === "/api/onboarding/cards") {
        const { user, streamer } = await checkCreator(request, supabase);
        const { data, error } = await supabase.from("cards").select("*").eq("streamer_id", streamer.id);
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse(data, 200, corsHeaders);
      }
      if (method === "GET" && path === "/api/trade/code") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const { data, error: dbError } = await supabase.from("users").select("trade_code").eq("twitch_id", user.twitch_id).single();
        if (dbError || !data?.trade_code) {
          const newCode = Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
          await supabase.from("users").update({ trade_code: newCode }).eq("twitch_id", user.twitch_id);
          return secureResponse({ trade_code: newCode }, 200, corsHeaders);
        }
        return secureResponse({ trade_code: data.trade_code }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/trade/code/reset") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const newCode = Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
        const { error: dbError } = await supabase.from("users").update({ trade_code: newCode }).eq("twitch_id", user.twitch_id);
        if (dbError) return secureResponse("Failed to reset code", 500, corsHeaders, true);
        return secureResponse({ trade_code: newCode }, 200, corsHeaders);
      }
      if (method === "PATCH" && path === "/api/user/binder-config") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        try {
          const body = await request.json();
          const updates = {};
          if (body.layout) updates.binder_layout = body.layout;
          if (body.theme) updates.binder_theme = body.theme;
          if (Object.keys(updates).length === 0) {
            return secureResponse("No changes provided", 400, corsHeaders, true);
          }
          const { error: dbError } = await supabase.from("users").update(updates).eq("twitch_id", user.twitch_id);
          if (dbError) throw dbError;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || "Update failed", 500, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/binders") {
        try {
          const user = await getUserFromSession(request, env, supabase);
          if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
          const { data, error } = await supabase.from("user_binders").select("*, user_binder_cards(user_card_id, sort_order)").eq("user_id", user.twitch_id).order("sort_order", { ascending: true });
          if (error) {
            if (error.code === "42P01" || error.code === "42501" || error.message?.includes("does not exist") || error.message?.includes("permission denied")) {
              console.warn("[Binders] Table does not exist or permission denied, returning empty array");
              return secureResponse([], 200, corsHeaders);
            }
            console.error("[Binders] Database error:", error);
            return secureResponse([], 200, corsHeaders);
          }
          return secureResponse(data || [], 200, corsHeaders);
        } catch (e) {
          console.error("[Binders] Exception:", e);
          return secureResponse([], 200, corsHeaders);
        }
      }
      if (method === "POST" && path === "/api/binders") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        try {
          const { name } = await request.json();
          if (!name) return secureResponse("Name is required", 400, corsHeaders, true);
          const { data, error } = await supabase.from("user_binders").insert({ user_id: user.twitch_id, name }).select().single();
          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || "Failed to create binder", 500, corsHeaders, true);
        }
      }
      if (method === "PATCH" && path === "/api/binders") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        try {
          const { id, name } = await request.json();
          if (!id || !name) return secureResponse("ID and name required", 400, corsHeaders, true);
          const { error } = await supabase.from("user_binders").update({ name }).eq("id", id).eq("user_id", user.twitch_id);
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || "Failed to rename binder", 500, corsHeaders, true);
        }
      }
      if (method === "DELETE" && path === "/api/binders") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const id = url.searchParams.get("id");
        if (!id) return secureResponse("Missing binder ID", 400, corsHeaders, true);
        const { error } = await supabase.from("user_binders").delete().eq("id", id).eq("user_id", user.twitch_id);
        if (error) return secureResponse("Failed to delete binder", 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/binders/cards") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        try {
          const { binder_id, user_card_ids, start_slot } = await request.json();
          if (!binder_id || !user_card_ids || !Array.isArray(user_card_ids)) {
            return secureResponse("Invalid request", 400, corsHeaders, true);
          }
          const { data: binder } = await supabase.from("user_binders").select("id").eq("id", binder_id).eq("user_id", user.twitch_id).single();
          if (!binder) return secureResponse("Binder not found", 404, corsHeaders, true);
          let nextSlot;
          if (typeof start_slot === "number") {
            nextSlot = start_slot;
          } else {
            const { data: maxOrderData } = await supabase.from("user_binder_cards").select("sort_order").eq("binder_id", binder_id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
            nextSlot = (maxOrderData?.sort_order ?? -1) + 1;
          }
          const items = user_card_ids.map((id) => {
            const item = {
              binder_id,
              user_card_id: id,
              sort_order: nextSlot
            };
            nextSlot++;
            return item;
          });
          const { error } = await supabase.from("user_binder_cards").upsert(items, { onConflict: "binder_id,user_card_id" });
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || "Failed to add cards", 500, corsHeaders, true);
        }
      }
      if (method === "DELETE" && path === "/api/binders/cards") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const binder_id = url.searchParams.get("binder_id");
        const user_card_id = url.searchParams.get("user_card_id");
        if (!binder_id || !user_card_id) return secureResponse("Missing parameters", 400, corsHeaders, true);
        const { data: binder } = await supabase.from("user_binders").select("id").eq("id", binder_id).eq("user_id", user.twitch_id).single();
        if (!binder) return secureResponse("Binder not found", 404, corsHeaders, true);
        const { error } = await supabase.from("user_binder_cards").delete().eq("binder_id", binder_id).eq("user_card_id", user_card_id);
        if (error) return secureResponse("Failed to remove card", 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }
      if (method === "PATCH" && path === "/api/binders/cards/sort") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        try {
          const { binder_id, order } = await request.json();
          if (!binder_id || !order || !Array.isArray(order)) return secureResponse("Missing params", 400, corsHeaders, true);
          const { data: binder } = await supabase.from("user_binders").select("id").eq("id", binder_id).eq("user_id", user.twitch_id).single();
          if (!binder) return secureResponse("Binder not found", 404, corsHeaders, true);
          const updates = order.map((item) => ({
            binder_id,
            user_card_id: item.user_card_id,
            sort_order: item.sort_order
          }));
          const { error } = await supabase.from("user_binder_cards").upsert(updates, { onConflict: "binder_id,user_card_id" });
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || "Sort update failed", 500, corsHeaders, true);
        }
      }
      if (method === "PATCH" && path === "/api/binders/sort") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        try {
          const { order } = await request.json();
          if (!order || !Array.isArray(order)) return secureResponse("Missing params", 400, corsHeaders, true);
          const updates = order.map((item) => ({
            id: item.id,
            user_id: user.twitch_id,
            sort_order: item.sort_order
          }));
          const { error } = await supabase.from("user_binders").upsert(updates, { onConflict: "id" });
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || "Binder sort failed", 500, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/trade/offer") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        try {
          const body = await request.json();
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse("Streamer context not found", 404, corsHeaders, true);
          const { data: receiver, error: rError } = await supabase.from("users").select("twitch_id, username").eq("trade_code", body.target_code).single();
          if (rError || !receiver) {
            await logSystem(supabase, "warn", "system", `Invalid trade code attempt by ${user.username}: ${body.target_code}`, streamer.id, { user_id: user.twitch_id });
            return secureResponse("Invalid trade code", 404, corsHeaders, true);
          }
          if (receiver.twitch_id === user.twitch_id) {
            await logSystem(supabase, "warn", "system", `User ${user.username} tried to trade with themselves`, streamer.id, { user_id: user.twitch_id, username: user.username });
            return secureResponse("You cannot trade with yourself", 400, corsHeaders, true);
          }
          const { data: trade, error: tError } = await supabase.from("trades").insert({
            streamer_id: streamer.id,
            sender_id: user.twitch_id,
            receiver_id: receiver.twitch_id,
            status: "pending"
          }).select().single();
          if (tError) throw tError;
          const items = body.sender_items.map((id) => ({
            trade_id: trade.id,
            user_card_id: id,
            owner_id: user.twitch_id
          }));
          const { error: iError } = await supabase.from("trade_items").insert(items);
          if (iError) throw iError;
          await supabase.from("notifications").insert({
            twitch_id: receiver.twitch_id,
            streamer_id: streamer.id,
            type: "trade_request",
            message: `You received a trade offer from ${user.username} in @${streamer.username}'s stream!`,
            data: { trade_id: trade.id, sender_name: user.username }
          });
          await logSystem(supabase, "info", "trade", `Trade ${trade.id} initiated: ${user.username} -> ${receiver.username} (${items.length} cards) (@${streamer.username})`, streamer.id, { trade_id: trade.id, sender: user.username, receiver: receiver.username });
          return secureResponse({ success: true, trade_id: trade.id }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || "Trade failed", 500, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/trades") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse("Streamer context not found", 404, corsHeaders, true);
        const { data: trades, error: tError } = await supabase.from("trades").select(`
            *,
            sender:users!trades_sender_id_fkey(username, avatar_url),
            receiver:users!trades_receiver_id_fkey(username, avatar_url),
            items:trade_items(
              *,
              card:enriched_user_cards(*)
            )
          `).eq("streamer_id", streamer.id).or(`sender_id.eq.${user.twitch_id},receiver_id.eq.${user.twitch_id}`).order("created_at", { ascending: false });
        if (tError) return secureResponse(tError.message, 500, corsHeaders, true);
        return secureResponse(trades, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/trade/offer-reply") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        try {
          const body = await request.json();
          console.log(`[TradeReply] Processing trade ${body.trade_id} from ${user.username}`);
          const { data: trade, error: tError } = await supabase.from("trades").select("*").eq("id", body.trade_id).single();
          if (tError || !trade) {
            console.error(`[TradeReply] Trade not found: ${body.trade_id}`);
            return secureResponse("Trade not found", 404, corsHeaders, true);
          }
          if (trade.receiver_id !== user.twitch_id) return secureResponse("Unauthorized", 403, corsHeaders, true);
          if (trade.status !== "pending") return secureResponse("Trade no longer pending counter-offer", 400, corsHeaders, true);
          const items = body.receiver_items.map((id) => ({
            trade_id: trade.id,
            user_card_id: id,
            owner_id: user.twitch_id
          }));
          const { error: iError } = await supabase.from("trade_items").insert(items);
          if (iError) throw iError;
          await supabase.from("trades").update({ status: "offered" }).eq("id", trade.id);
          const { data: sender } = await supabase.from("users").select("username").eq("twitch_id", trade.sender_id).single();
          await supabase.from("notifications").insert({
            twitch_id: trade.sender_id,
            streamer_id: trade.streamer_id,
            type: "trade_offered",
            message: `${user.username} has offered card(s) back for your trade!`,
            data: { trade_id: trade.id, receiver_name: user.username }
          });
          await logSystem(supabase, "info", "trade", `Trade ${trade.id} counter-offered by ${user.username} (${items.length} cards)`, trade.streamer_id, { trade_id: trade.id, responder: user.username });
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || "Offer reply failed", 500, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/trade/respond") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        try {
          const body = await request.json();
          const { data: trade, error: tError } = await supabase.from("trades").select("*").eq("id", body.trade_id).single();
          if (tError || !trade) return secureResponse("Trade not found", 404, corsHeaders, true);
          if (body.action === "accept") {
            console.log(`[TradeRespond] Accept attempt by ${user.username} for trade ${trade.id}`);
            if (trade.sender_id !== user.twitch_id) return secureResponse("Only the initiator can accept the final trade offer", 403, corsHeaders, true);
            if (trade.status !== "offered") return secureResponse('Trade must be in "offered" status to be accepted', 400, corsHeaders, true);
            const { data: success, error: rpcError } = await supabase.rpc("accept_trade", { trade_uuid: trade.id });
            if (rpcError || !success) {
              console.error(`[TradeRespond] RPC failed:`, rpcError);
              await logSystem(supabase, "error", "system", `Trade completion failed for Trade ID: ${trade.id}`, void 0, {
                user_id: user.twitch_id,
                username: user.username,
                error: rpcError?.message || "RPC failed"
              });
              return secureResponse("Trade failed. Items might have moved or been traded already.", 400, corsHeaders, true);
            }
            await supabase.from("notifications").insert({
              twitch_id: trade.sender_id,
              streamer_id: trade.streamer_id,
              type: "trade_completed",
              message: `Your trade with ${user.username} was successful!`,
              data: { trade_id: trade.id }
            });
            const unlockAchievement = /* @__PURE__ */ __name(async (tid, sid) => {
              const { data: hasIt } = await supabase.from("user_achievements").select("*").eq("twitch_id", tid).eq("achievement_id", "trader_debut").eq("streamer_id", sid).maybeSingle();
              if (!hasIt) {
                await supabase.from("user_achievements").insert({ twitch_id: tid, achievement_id: "trader_debut", streamer_id: sid });
                await supabase.from("notifications").insert({
                  twitch_id: tid,
                  streamer_id: sid,
                  type: "achievement_unlock",
                  message: `\u{1F3C6} Achievement Unlocked: TRADER DEBUT! \u{1F91D}`,
                  data: { achievement_id: "trader_debut" }
                });
              }
            }, "unlockAchievement");
            await unlockAchievement(trade.sender_id, trade.streamer_id);
            await unlockAchievement(trade.receiver_id, trade.streamer_id);
            await logSystem(supabase, "info", "trade", `Trade ${trade.id} COMPLETED: ${user.username} accepted counter-offer.`, void 0, { trade_id: trade.id });
            return secureResponse({ success: true }, 200, corsHeaders);
          } else {
            const newStatus = body.action === "reject" ? "rejected" : "cancelled";
            if (body.action === "reject" && trade.receiver_id !== user.twitch_id) {
              await logSystem(supabase, "warn", "auth", `Unauthorized trade rejection attempt by ${user.username}`, void 0, { user_id: user.twitch_id, trade_id: trade.id });
              return secureResponse("Unauthorized", 403, corsHeaders, true);
            }
            if (body.action === "cancel" && trade.sender_id !== user.twitch_id) {
              await logSystem(supabase, "warn", "auth", `Unauthorized trade cancellation attempt by ${user.username}`, void 0, { user_id: user.twitch_id, trade_id: trade.id });
              return secureResponse("Unauthorized", 403, corsHeaders, true);
            }
            await supabase.from("trades").update({ status: newStatus }).eq("id", trade.id);
            if (body.action === "reject") {
              await supabase.from("notifications").insert({
                twitch_id: trade.sender_id,
                streamer_id: trade.streamer_id,
                type: "trade_rejected",
                message: `${user.username} rejected your trade offer.`,
                data: { trade_id: trade.id }
              });
            }
            await logSystem(supabase, "info", "trade", `Trade ${trade.id} ${newStatus} by ${user.username}`, void 0, { trade_id: trade.id, action: body.action });
            return secureResponse({ success: true, status: newStatus }, 200, corsHeaders);
          }
        } catch (e) {
          return secureResponse(e.message || "Operation failed", 500, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/trade/in") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        try {
          const body = await request.json();
          if (!body.user_card_ids || body.user_card_ids.length !== 5) {
            await logSystem(supabase, "warn", "system", `Invalid trade-in attempt by ${user.username}: Exactly 5 cards required`, void 0, { user_id: user.twitch_id, count: body.user_card_ids?.length });
            return secureResponse("Exactly 5 cards required for trade-in", 400, corsHeaders, true);
          }
          console.log(`[TradeIn] Request from ${user.username} (${user.twitch_id}) for IDs:`, body.user_card_ids);
          const { data: cards, error: fetchError } = await supabase.from("enriched_user_cards").select("*").eq("twitch_id", user.twitch_id).in("user_card_id", body.user_card_ids);
          if (fetchError || !cards || cards.length !== 5) {
            const errorMsg = fetchError ? fetchError.message : `Only found ${cards?.length || 0} of 5 cards requested`;
            await logSystem(supabase, "error", "system", `Trade-in verification failed for ${user.username}: ${errorMsg}`, void 0, {
              user_id: user.twitch_id,
              error: errorMsg,
              requested_ids: body.user_card_ids,
              found_count: cards?.length || 0
            });
            return secureResponse(errorMsg || "Could not find all 5 cards in your collection", 404, corsHeaders, true);
          }
          const rawRarity = cards[0].rarity;
          const rarityOrder = ["Common", "Rare", "Epic", "Legendary"];
          const currentIndex = rarityOrder.findIndex((r) => r.toLowerCase() === rawRarity.toLowerCase());
          if (currentIndex === -1) {
            await logSystem(supabase, "error", "system", `Invalid rarity found in trade-in: ${rawRarity}`, void 0, { user_id: user.twitch_id });
            return secureResponse(`Invalid rarity: ${rawRarity}`, 400, corsHeaders, true);
          }
          if (!cards.every((c) => c.rarity.toLowerCase() === rawRarity.toLowerCase())) {
            await logSystem(supabase, "warn", "system", `Trade-in rarity mismatch for ${user.username}`, void 0, { user_id: user.twitch_id });
            return secureResponse("All cards must be of the same rarity", 400, corsHeaders, true);
          }
          if (currentIndex === rarityOrder.length - 1) {
            return secureResponse("Cannot upgrade Legendary cards!", 400, corsHeaders, true);
          }
          const nextRarity = rarityOrder[currentIndex + 1];
          const { data: pool, error: poolError } = await supabase.from("cards").select("*").eq("rarity", nextRarity);
          if (poolError || !pool || pool.length === 0) {
            await logSystem(supabase, "error", "system", `No cards found for upgrade tier: ${nextRarity}`, void 0, { error: poolError?.message });
            return secureResponse("No available cards in next rarity tier", 500, corsHeaders, true);
          }
          const newCard = pool[Math.floor(Math.random() * pool.length)];
          const { error: delError } = await supabase.from("user_cards").delete().in("id", body.user_card_ids).eq("twitch_id", user.twitch_id);
          if (delError) {
            await logSystem(supabase, "error", "system", `Trade-in delete failed for ${user.username}`, void 0, { error: delError.message });
            throw delError;
          }
          const { data: granted, error: insError } = await supabase.from("user_cards").insert({
            twitch_id: user.twitch_id,
            card_id: newCard.id,
            streamer_id: newCard.streamer_id,
            granted_by_streamer: newCard.streamer_id,
            is_obs_consumed: true,
            attack: newCard.attack,
            defense: newCard.defense,
            max_hp: newCard.defense,
            mechanic_id: newCard.mechanic_id
          }).select().single();
          if (insError) {
            await logSystem(supabase, "error", "system", `Trade-in insert failed for ${user.username}`, void 0, { error: insError.message });
            throw insError;
          }
          const { data: flatCard } = await supabase.from("enriched_user_cards").select("*").eq("user_card_id", granted.id).single();
          await logSystem(supabase, "info", "grant", `User ${user.username} traded in 5 ${rawRarity}s for a ${nextRarity}: ${newCard.name}`, void 0, { user_id: user.twitch_id });
          return secureResponse({ success: true, card: flatCard }, 200, corsHeaders);
        } catch (e) {
          await logSystem(supabase, "error", "system", `Fatal trade-in error for ${user.username}`, void 0, {
            user_id: user.twitch_id,
            error: e.message
          });
          return secureResponse(e.message || "Trade-in failed", 500, corsHeaders, true);
        }
      }
      if (method === "GET" && path.startsWith("/api/public/collection/")) {
        const code = path.split("/").pop();
        if (!code) return secureResponse("Invalid code", 400, corsHeaders, true);
        const { data: targetUser, error: uError } = await supabase.from("users").select("twitch_id").eq("trade_code", code).single();
        if (uError || !targetUser) return secureResponse("User not found", 404, corsHeaders, true);
        const { data: cards, error: cError } = await supabase.from("enriched_user_cards").select("*").eq("twitch_id", targetUser.twitch_id);
        if (cError) return secureResponse(cError.message, 500, corsHeaders, true);
        return secureResponse(cards, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/admin/login") {
        let username = "unknown";
        try {
          const body = await request.json();
          username = body.username;
          const password = body.password;
          if (username !== "codeoce" || password !== env.ADMIN_PASSWORD) {
            return new Response(JSON.stringify({ error: "Invalid credentials" }), {
              status: 401,
              headers: corsHeaders
            });
          }
          const adminToken = await new SignJWT({ admin: true, username }).setProtectedHeader({ alg: "HS256" }).setIssuer("mulistreamer-tcg-admin").setAudience("mulistreamer-tcg-admin-panel").setIssuedAt().setExpirationTime("12h").sign(new TextEncoder().encode(env.ADMIN_SECRET));
          const isHttps = request.url.startsWith("https");
          const secureFlag = isHttps ? "; Secure" : "";
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
              ...corsHeaders,
              "Set-Cookie": `admin_session=${adminToken}; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=43200`
            }
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message || String(e) : String(e);
          await logSystem(supabase, "warn", "auth", `Admin login failed for user: ${username}. Error: ${msg}`, void 0, { username });
          return new Response(JSON.stringify({ error: "Login failed" }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      if (method === "POST" && path === "/api/admin/logout") {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Set-Cookie": "admin_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0"
          }
        });
      }
      if (method === "GET" && path === "/api/admin/check") {
        const cookie = request.headers.get("Cookie");
        const token = cookie?.match(/admin_session=([^;]+)/)?.[1];
        if (!token) {
          return new Response(JSON.stringify({ authenticated: false }), {
            status: 200,
            headers: corsHeaders
          });
        }
        try {
          const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(env.ADMIN_SECRET),
            { issuer: "mulistreamer-tcg-admin", audience: "mulistreamer-tcg-admin-panel" }
          );
          if (payload.admin !== true) {
            return new Response(JSON.stringify({ authenticated: false }), {
              status: 200,
              headers: corsHeaders
            });
          }
          return new Response(JSON.stringify({
            authenticated: true,
            username: payload.username
          }), {
            status: 200,
            headers: corsHeaders
          });
        } catch {
          return new Response(JSON.stringify({ authenticated: false }), {
            status: 200,
            headers: corsHeaders
          });
        }
      }
      if (method === "POST" && path === "/api/admin/cards") {
        try {
          await checkAdmin(request);
          const body = await request.json();
          const { error } = await supabase.from("cards").upsert({
            id: body.id,
            streamer_id: body.streamer_id || body.creator_id,
            // Backward compatibility
            name: body.name,
            image_url: body.image_url,
            rarity: body.rarity,
            type: body.type || "Unit",
            set_id: body.set_id,
            card_number: body.card_number,
            description: body.description,
            attack: body.attack || 0,
            defense: body.defense || 0
          });
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || String(e) || "Unauthorized", 401, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/admin/upload") {
        try {
          await checkAdmin(request);
          const formData = await request.formData();
          const file = formData.get("file");
          if (!file) {
            return secureResponse("No file uploaded", 400, corsHeaders, true);
          }
          if (file.size > CARD_IMAGE_MAX_BYTES) {
            return secureResponse(`File too large. Max ${CARD_IMAGE_MAX_BYTES / (1024 * 1024)}MB.`, 413, corsHeaders, true);
          }
          const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
          const ext = file.type === "image/webp" ? ".webp" : (file.name.match(/\.[^/.]+$/) || [".webp"])[0];
          const fileName = `${Date.now()}-${baseName}${ext}`;
          const filePath = `${fileName}`;
          const { data, error } = await supabase.storage.from("card-images").upload(filePath, file, {
            cacheControl: "3600",
            upsert: false
          });
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from("card-images").getPublicUrl(filePath);
          return secureResponse({ success: true, url: publicUrl }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || String(e) || "Server error", 500, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/admin/cards/bulk") {
        try {
          await checkAdmin(request);
          const body = await request.json();
          const cards = body.cards;
          if (!Array.isArray(cards) || cards.length === 0) {
            throw new Error("Invalid cards array");
          }
          const cardsToInsert = cards.map((card) => ({
            id: card.id,
            streamer_id: card.streamer_id || card.creator_id,
            name: card.name,
            image_url: card.image_url,
            rarity: card.rarity,
            type: card.type || "Unit",
            set_id: card.set_id,
            card_number: card.card_number,
            description: card.description,
            attack: card.attack || 0,
            defense: card.defense || 0
          }));
          const { error } = await supabase.from("cards").upsert(cardsToInsert);
          if (error) throw error;
          return secureResponse({ success: true, count: cards.length }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || String(e) || "Batch failed", 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/admin/users") {
        try {
          await checkAdmin(request);
          const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false }).limit(50);
          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || String(e) || "Unauthorized", 401, corsHeaders, true);
        }
      }
      if (method === "DELETE" && path === "/api/admin/users") {
        try {
          await checkAdmin(request);
          const targetId = url.searchParams.get("target_id");
          if (!targetId) throw new Error("Missing target_id");
          const { error } = await supabase.from("user_cards").delete().eq("twitch_id", targetId);
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || String(e) || "Unauthorized", 401, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/admin/grant") {
        try {
          await checkAdmin(request);
          const body = await request.json();
          const { data: user, error: userError } = await supabase.from("users").select("twitch_id").ilike("username", body.username).single();
          if (userError || !user) throw new Error("User not found");
          const { data: card, error: cardError } = await supabase.from("cards").select("id, name, rarity, image_url, streamer_id, attack, defense, mechanic_id").eq("id", body.card_id).single();
          if (cardError || !card) throw new Error("Card not found");
          const quantity = body.quantity || 1;
          const grants = [];
          for (let i = 0; i < quantity; i++) {
            grants.push({
              twitch_id: user.twitch_id,
              card_id: card.id,
              streamer_id: card.streamer_id,
              granted_by_streamer: card.streamer_id,
              attack: card.attack,
              defense: card.defense,
              max_hp: card.defense,
              mechanic_id: card.mechanic_id
            });
          }
          const { error: insertError } = await supabase.from("user_cards").insert(grants);
          if (insertError) throw insertError;
          const notifications = grants.map((g) => ({
            twitch_id: g.twitch_id,
            streamer_id: card.streamer_id,
            type: "card_drop",
            message: `You received a new card: ${card.name} (${card.rarity})!`,
            data: { card_id: card.id, rarity: card.rarity, image_url: card.image_url }
          }));
          await supabase.from("notifications").insert(notifications);
          await checkAndUnlockAchievements(supabase, user.twitch_id, card, card.streamer_id);
          await logSystem(supabase, "info", "grant", `Manually granted ${quantity} x ${card.name} to ${body.username}`, card.streamer_id, { target_username: body.username, card_id: card.id });
          return secureResponse({ success: true, count: quantity }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || String(e) || "Grant failed", 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/notifications") {
        try {
          const user = await getUserFromSession(request, env, supabase);
          if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
          const userId = user.twitch_id;
          console.log(`[Notifications] Fetching for user: ${userId}`);
          const { data: notifications, error: dbError } = await supabase.from("notifications").select("*").eq("twitch_id", userId).eq("read", false).order("created_at", { ascending: false }).limit(50);
          if (dbError) {
            if (dbError.code === "42P01" || dbError.message?.includes("does not exist") || dbError.message?.includes("permission denied")) {
              console.warn("[Notifications] Table does not exist or permission denied, returning empty array");
              return secureResponse([], 200, corsHeaders);
            }
            console.error("[Notifications] DB Error:", dbError);
            return secureResponse([], 200, corsHeaders);
          }
          return secureResponse(notifications || [], 200, corsHeaders);
        } catch (e) {
          console.error("[Notifications] Exception:", e);
          return secureResponse([], 200, corsHeaders);
        }
      }
      if (method === "POST" && path === "/api/notifications") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const userId = user.twitch_id;
        let body;
        try {
          body = await request.json();
        } catch {
          return secureResponse("Invalid JSON", 400, corsHeaders, true);
        }
        if (!body.ids || !Array.isArray(body.ids)) {
          return secureResponse("Missing ids array", 400, corsHeaders, true);
        }
        const { error: updateError } = await supabase.from("notifications").delete().eq("twitch_id", userId).in("id", body.ids);
        if (updateError) {
          console.error("[Notifications] Update Error:", updateError);
          return secureResponse("Database error", 500, corsHeaders, true);
        }
        return secureResponse({ success: true }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/creator/onboard") {
        try {
          const u = await getUserFromSession(request, env, supabase);
          if (!u) return secureResponse("Unauthorized", 401, corsHeaders, true);
          console.log("[Onboard] Creating streamer for user:", u.username, "twitch_id:", u.twitch_id);
          const { data: existing } = await supabase.from("streamers").select("id").eq("twitch_id", u.twitch_id).maybeSingle();
          if (existing) {
            console.log("[Onboard] Streamer already exists");
            return secureResponse({ success: true, message: "Already a creator" }, 200, corsHeaders);
          }
          const { data: newStreamer, error: onboardErr } = await supabase.from("streamers").insert({
            twitch_id: u.twitch_id,
            username: u.username.toLowerCase(),
            display_name: u.username,
            brand_name: u.username,
            avatar_url: u.avatar_url,
            is_active: false
            // Start inactive until setup is complete
          }).select().single();
          if (onboardErr) {
            console.error("[Onboard] Error:", onboardErr);
            return secureResponse("Failed to onboard: " + onboardErr.message, 500, corsHeaders, true);
          }
          console.log("[Onboard] Successfully created streamer:", newStreamer?.id);
          return secureResponse({ success: true, streamer_id: newStreamer?.id }, 200, corsHeaders);
        } catch (e) {
          console.error("[Onboard] Exception:", e);
          return secureResponse("Error: " + e.message, 500, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/profile") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { count: cardCount } = await supabase.from("cards").select("*", { count: "exact", head: true }).eq("streamer_id", streamer.id);
          const { count: setCount } = await supabase.from("streamer_sets").select("*", { count: "exact", head: true }).eq("streamer_id", streamer.id);
          return secureResponse({
            ...streamer,
            stats: { cardCount: cardCount || 0, setCount: setCount || 0 }
          }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/setup-status") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { count: cardCount } = await supabase.from("cards").select("*", { count: "exact", head: true }).eq("streamer_id", streamer.id);
          const { data: rarityConfig } = await supabase.from("streamer_rarity_configs").select("*").eq("streamer_id", streamer.id).maybeSingle();
          const setupComplete = !!(streamer.brand_name && streamer.is_active);
          return secureResponse({ setup_complete: setupComplete }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/obs-token") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          console.log("[OBS Token] Streamer ID:", streamer.id);
          console.log("[OBS Token] Streamer username:", streamer.username);
          console.log("[OBS Token] Current token exists:", !!streamer.obs_overlay_token);
          console.log("[OBS Token] Current token value:", streamer.obs_overlay_token || "null");
          let token = streamer.obs_overlay_token;
          if (!token) {
            const randomBytes = new Uint8Array(16);
            crypto.getRandomValues(randomBytes);
            token = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
            console.log("[OBS Token] Generated new token:", token.substring(0, 8) + "...");
            console.log("[OBS Token] Full token:", token);
            console.log("[OBS Token] Attempting to save to database...");
            const { data: updated, error: updateError } = await supabase.from("streamers").update({ obs_overlay_token: token }).eq("id", streamer.id).select("obs_overlay_token").single();
            if (updateError) {
              console.error("[OBS Token] Database update error:", updateError);
              console.error("[OBS Token] Error code:", updateError.code);
              console.error("[OBS Token] Error message:", updateError.message);
              console.error("[OBS Token] Error details:", updateError.details);
              console.error("[OBS Token] Error hint:", updateError.hint);
              if (updateError.code === "42703" || updateError.message?.includes("column") || updateError.message?.includes("obs_overlay_token")) {
                return secureResponse({
                  error: "Database column missing",
                  message: "The obs_overlay_token column does not exist. Please run migration 004_obs_overlay_token.sql in your Supabase SQL editor.",
                  migration_hint: "Run: ALTER TABLE streamers ADD COLUMN IF NOT EXISTS obs_overlay_token TEXT;"
                }, 500, corsHeaders);
              }
              return secureResponse({
                error: "Failed to save token to database",
                message: updateError.message,
                code: updateError.code,
                details: updateError.details,
                hint: updateError.hint
              }, 500, corsHeaders);
            }
            if (!updated || !updated.obs_overlay_token) {
              console.error("[OBS Token] Update returned no data or empty token");
              return secureResponse({
                error: "Token was not saved",
                message: "Database update succeeded but token was not returned. Please try again."
              }, 500, corsHeaders);
            }
            console.log("[OBS Token] Token saved successfully!");
            console.log("[OBS Token] Verified token in DB:", updated.obs_overlay_token.substring(0, 8) + "...");
          }
          console.log("[OBS Token] Returning token to client");
          return secureResponse({ token }, 200, corsHeaders);
        } catch (e) {
          console.error("[OBS Token] Exception:", e);
          console.error("[OBS Token] Stack:", e.stack);
          return secureResponse({
            error: e.message || "Failed to get token",
            type: e.constructor?.name || "Unknown"
          }, 400, corsHeaders);
        }
      }
      if (method === "POST" && path === "/api/creator/obs-token/regenerate") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          console.log("[OBS Token Regenerate] Streamer ID:", streamer.id);
          console.log("[OBS Token Regenerate] Current token exists:", !!streamer.obs_overlay_token);
          const randomBytes = new Uint8Array(16);
          crypto.getRandomValues(randomBytes);
          const token = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
          console.log("[OBS Token Regenerate] Generated new token:", token.substring(0, 8) + "...");
          console.log("[OBS Token Regenerate] Full token:", token);
          console.log("[OBS Token Regenerate] Attempting to save to database...");
          const { data: updated, error: updateError } = await supabase.from("streamers").update({ obs_overlay_token: token }).eq("id", streamer.id).select("obs_overlay_token").single();
          if (updateError) {
            console.error("[OBS Token Regenerate] Database update error:", updateError);
            console.error("[OBS Token Regenerate] Error code:", updateError.code);
            console.error("[OBS Token Regenerate] Error message:", updateError.message);
            console.error("[OBS Token Regenerate] Error details:", updateError.details);
            console.error("[OBS Token Regenerate] Error hint:", updateError.hint);
            if (updateError.code === "42703" || updateError.message?.includes("column") || updateError.message?.includes("obs_overlay_token")) {
              return secureResponse({
                error: "Database column missing",
                message: "The obs_overlay_token column does not exist. Please run migration 004_obs_overlay_token.sql in your Supabase SQL editor.",
                migration_hint: "Run: ALTER TABLE streamers ADD COLUMN IF NOT EXISTS obs_overlay_token TEXT;"
              }, 500, corsHeaders);
            }
            return secureResponse({
              error: "Failed to regenerate token",
              message: updateError.message,
              code: updateError.code,
              details: updateError.details,
              hint: updateError.hint
            }, 500, corsHeaders);
          }
          if (!updated || !updated.obs_overlay_token) {
            console.error("[OBS Token Regenerate] Update returned no data or empty token");
            return secureResponse({
              error: "Token was not saved",
              message: "Database update succeeded but token was not returned. Please try again."
            }, 500, corsHeaders);
          }
          console.log("[OBS Token Regenerate] Token regenerated successfully!");
          console.log("[OBS Token Regenerate] Verified token in DB:", updated.obs_overlay_token.substring(0, 8) + "...");
          return secureResponse({ token }, 200, corsHeaders);
        } catch (e) {
          console.error("[OBS Token Regenerate] Exception:", e);
          console.error("[OBS Token Regenerate] Stack:", e.stack);
          return secureResponse({
            error: e.message || "Failed to regenerate token",
            type: e.constructor?.name || "Unknown"
          }, 400, corsHeaders);
        }
      }
      if (method === "PATCH" && path === "/api/creator/settings") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json();
          const updateData = {};
          if (b.reward_id !== void 0) updateData.twitch_reward_id = b.reward_id;
          if (b.battle_reward_id !== void 0) updateData.twitch_battle_reward_id = b.battle_reward_id;
          if (b.streamelements_jwt !== void 0) updateData.streamelements_jwt_encrypted = b.streamelements_jwt;
          if (b.streamelements_id !== void 0) updateData.streamelements_channel_id = b.streamelements_id;
          if (b.settings && b.settings.branding) {
            const branding = b.settings.branding;
            if (branding.tagline !== void 0) updateData.brand_tagline = branding.tagline;
          }
          if (b.brand_name !== void 0) updateData.brand_name = b.brand_name;
          if (b.brand_tagline !== void 0) updateData.brand_tagline = b.brand_tagline;
          if (b.brand_banner_url !== void 0) updateData.brand_banner_url = b.brand_banner_url;
          if (b.pack_image_url !== void 0) updateData.pack_image_url = b.pack_image_url;
          if (b.pack_image !== void 0) updateData.pack_image_url = b.pack_image;
          if (b.card_back_url !== void 0) updateData.card_back_url = b.card_back_url;
          if (b.pack_open_sound_url !== void 0) updateData.pack_open_sound_url = b.pack_open_sound_url;
          if (b.twitch_reward_id !== void 0) updateData.twitch_reward_id = b.twitch_reward_id;
          if (b.twitch_battle_reward_id !== void 0) updateData.twitch_battle_reward_id = b.twitch_battle_reward_id;
          if (b.battles_enabled !== void 0) updateData.battles_enabled = b.battles_enabled;
          if (b.trading_enabled !== void 0) updateData.trading_enabled = b.trading_enabled;
          if (b.binder_color !== void 0) updateData.binder_color = b.binder_color;
          const { error: updateErr } = await supabase.from("streamers").update(updateData).eq("id", streamer.id);
          if (updateErr) throw updateErr;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/creator/twitch/auto-reward") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const body = await request.json().catch(() => ({}));
          if (!streamer.twitch_access_token_encrypted) {
            throw new Error("Twitch is not fully connected with Channel Points permissions. Please reconnect as a creator.");
          }
          const cost = typeof body.cost === "number" && body.cost > 0 ? body.cost : 500;
          const title = body.title && String(body.title).trim() || "Open a Card Pack";
          const mode = body.mode === "once_per_stream" ? "once_per_stream" : "unlimited";
          const isMaxPerStreamEnabled = mode === "once_per_stream";
          const maxPerStream = isMaxPerStreamEnabled ? 1 : null;
          const twitchAccessToken = await decryptSensitive(streamer.twitch_access_token_encrypted, env.SESSION_SECRET);
          const twitchResp = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${streamer.twitch_id}`, {
            method: "POST",
            headers: {
              "Client-ID": env.TWITCH_CLIENT_ID,
              "Authorization": `Bearer ${twitchAccessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              title,
              cost,
              is_enabled: true,
              is_max_per_stream_enabled: isMaxPerStreamEnabled,
              max_per_stream: maxPerStream,
              // Keep other limits unlimited; creators can refine in Twitch dashboard if desired
              is_max_per_user_per_stream_enabled: false,
              is_global_cooldown_enabled: false
            })
          });
          const data = await twitchResp.json();
          if (!twitchResp.ok) {
            console.error("[Twitch Auto Reward] Failed:", twitchResp.status, data);
            throw new Error(data.message || "Failed to create Channel Points reward via Twitch API");
          }
          const reward = data.data && data.data[0];
          const rewardId = reward?.id;
          if (rewardId) {
            const { error: updErr } = await supabase.from("streamers").update({ twitch_reward_id: rewardId }).eq("id", streamer.id);
            if (updErr) throw updErr;
          }
          return secureResponse({ success: true, reward_id: rewardId, reward }, 200, corsHeaders);
        } catch (e) {
          console.error("[Twitch Auto Reward] Error:", e);
          return secureResponse({ error: e.message || "Failed to auto-create reward" }, 400, corsHeaders);
        }
      }
      if (method === "POST" && path === "/api/creator/rarity-config") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json();
          const { error: configErr } = await supabase.from("streamer_rarity_configs").upsert({
            streamer_id: streamer.id,
            common_weight: b.common || 70,
            rare_weight: b.rare || 20,
            epic_weight: b.epic || 8,
            legendary_weight: b.legendary || 2
          }, { onConflict: "streamer_id" });
          if (configErr) throw configErr;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/creator/activate") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          console.log(`[Creator/Activate] Checking activation for streamer: ${streamer.id}`);
          console.log(`[Creator/Activate] Current reward_id: ${streamer.twitch_reward_id}`);
          console.log(`[Creator/Activate] Current is_active: ${streamer.is_active}`);
          const { count: cardCount, error: countError } = await supabase.from("cards").select("*", { count: "exact", head: true }).eq("streamer_id", streamer.id);
          if (countError) {
            console.error(`[Creator/Activate] Error counting cards:`, countError);
          } else {
            console.log(`[Creator/Activate] Card count: ${cardCount || 0}`);
          }
          const { error: activateErr } = await supabase.from("streamers").update({ is_active: true }).eq("id", streamer.id);
          if (activateErr) {
            console.error(`[Creator/Activate] Error activating:`, activateErr);
            throw activateErr;
          }
          return secureResponse({
            success: true,
            message: "Streamer activated successfully",
            hints: {
              has_reward: !!streamer.twitch_reward_id,
              card_count: cardCount || 0
            }
          }, 200, corsHeaders);
        } catch (e) {
          console.error(`[Creator/Activate] Exception:`, e);
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/cards") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { data: cData, error: cErr } = await supabase.from("cards").select("*").eq("streamer_id", streamer.id).order("created_at", { ascending: false });
          if (cErr) throw cErr;
          return secureResponse(cData, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/creator/cards") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json();
          if (b.set_id) {
            const { data: setCheck, error: setCheckErr } = await supabase.from("streamer_sets").select("id").eq("id", b.set_id).eq("streamer_id", streamer.id).maybeSingle();
            if (setCheckErr || !setCheck) {
              return secureResponse("Invalid Set ID or you do not have permission to use this set", 400, corsHeaders, true);
            }
          }
          const isUpdate = !!b.id;
          let cardData = {};
          if (isUpdate) {
            const { data: existingCard, error: fetchErr } = await supabase.from("cards").select("*").eq("id", b.id).eq("streamer_id", streamer.id).maybeSingle();
            if (fetchErr) throw fetchErr;
            if (!existingCard) return secureResponse("Card not found", 404, corsHeaders, true);
            if (b.image_url && b.image_url !== existingCard.image_url) {
              const r2Key = getR2KeyFromImageUrl(existingCard.image_url);
              if (r2Key && env.CARD_IMAGES) {
                try {
                  await env.CARD_IMAGES.delete(r2Key);
                } catch (_) {
                }
              }
            }
            cardData = {
              ...existingCard,
              ...b,
              streamer_id: streamer.id
              // Ensure ownership
            };
            delete cardData.updated_at;
          } else {
            const cardId = `${streamer.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            cardData = {
              id: cardId,
              streamer_id: streamer.id,
              name: b.name || "Untitled Card",
              rarity: b.rarity || "Common",
              type: b.type || "Unit",
              description: b.description || "",
              attack: b.attack || 0,
              defense: b.defense || 0,
              image_url: b.image_url || "/pack.png",
              is_approved: true,
              set_id: b.set_id || null,
              card_number: b.card_number || null,
              created_at: (/* @__PURE__ */ new Date()).toISOString()
            };
          }
          const { data, error: upsertErr } = await supabase.from("cards").upsert(cardData).select().single();
          if (upsertErr) throw upsertErr;
          if (b.attack !== void 0 || b.defense !== void 0) {
            await supabase.from("user_cards").update({
              attack: cardData.attack,
              defense: cardData.defense,
              max_hp: cardData.defense
            }).eq("card_id", cardData.id);
          }
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          console.error("[Creator Cards POST] Error:", e);
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/card-backs") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { data, error } = await supabase.from("streamer_card_backs").select("*").eq("streamer_id", streamer.id).order("is_default", { ascending: false }).order("created_at", { ascending: false });
          if (error) throw error;
          return secureResponse(data || [], 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/creator/card-backs") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json();
          const cardBackData = {
            streamer_id: streamer.id,
            name: b.name || "Card Back",
            image_url: b.image_url,
            description: b.description || null,
            is_default: b.is_default || false,
            is_active: true
          };
          const { data, error } = await supabase.from("streamer_card_backs").insert(cardBackData).select().single();
          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "PUT" && path.startsWith("/api/creator/card-backs/")) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const cardBackId = path.split("/").pop();
          const { data: existing, error: checkErr } = await supabase.from("streamer_card_backs").select("id").eq("id", cardBackId).eq("streamer_id", streamer.id).single();
          if (checkErr || !existing) {
            return secureResponse("Card back not found or access denied", 404, corsHeaders, true);
          }
          const b = await request.json();
          const updateData = {};
          if (b.name) updateData.name = b.name;
          if (b.image_url) updateData.image_url = b.image_url;
          if (b.description !== void 0) updateData.description = b.description;
          if (b.is_default !== void 0) updateData.is_default = b.is_default;
          if (b.is_active !== void 0) updateData.is_active = b.is_active;
          updateData.updated_at = (/* @__PURE__ */ new Date()).toISOString();
          const { data, error } = await supabase.from("streamer_card_backs").update(updateData).eq("id", cardBackId).select().single();
          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "DELETE" && path.startsWith("/api/creator/card-backs/")) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const cardBackId = path.split("/").pop();
          const { data: existing, error: checkErr } = await supabase.from("streamer_card_backs").select("id").eq("id", cardBackId).eq("streamer_id", streamer.id).single();
          if (checkErr || !existing) {
            return secureResponse("Card back not found or access denied", 404, corsHeaders, true);
          }
          const { error } = await supabase.from("streamer_card_backs").delete().eq("id", cardBackId);
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "POST" && path.startsWith("/api/creator/card-backs/") && path.endsWith("/set-default")) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const cardBackId = path.split("/")[4];
          const { data: existing, error: checkErr } = await supabase.from("streamer_card_backs").select("id").eq("id", cardBackId).eq("streamer_id", streamer.id).single();
          if (checkErr || !existing) {
            return secureResponse("Card back not found or access denied", 404, corsHeaders, true);
          }
          await supabase.from("streamer_card_backs").update({ is_default: false }).eq("streamer_id", streamer.id).neq("id", cardBackId);
          const { data, error } = await supabase.from("streamer_card_backs").update({ is_default: true }).eq("id", cardBackId).select().single();
          if (data) {
            await supabase.from("streamers").update({ card_back_url: data.image_url }).eq("id", streamer.id);
          }
          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/analytics/overview") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get("days") || "30");
          const { data: streamerData } = await supabase.from("streamers").select("total_cards, total_collectors, total_packs_opened").eq("id", streamer.id).single();
          const previousPeriodStart = /* @__PURE__ */ new Date();
          previousPeriodStart.setDate(previousPeriodStart.getDate() - days * 2);
          const previousPeriodEnd = /* @__PURE__ */ new Date();
          previousPeriodEnd.setDate(previousPeriodEnd.getDate() - days);
          const { data: collectorGrowth } = await supabase.from("user_cards").select("granted_at, twitch_id").eq("streamer_id", streamer.id).gte("granted_at", new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString()).order("granted_at", { ascending: true });
          const growthData = [];
          const startDate = /* @__PURE__ */ new Date();
          startDate.setDate(startDate.getDate() - days);
          for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split("T")[0];
            const dayCollectors = new Set(
              collectorGrowth?.filter((c) => c.granted_at?.startsWith(dateStr)).map((c) => c.twitch_id) || []
            );
            growthData.push({
              date: dateStr,
              count: dayCollectors.size
            });
          }
          const previousCollectors = await supabase.from("user_cards").select("twitch_id", { count: "exact", head: true }).eq("streamer_id", streamer.id).gte("granted_at", previousPeriodStart.toISOString()).lte("granted_at", previousPeriodEnd.toISOString());
          const currentCollectors = await supabase.from("user_cards").select("twitch_id", { count: "exact", head: true }).eq("streamer_id", streamer.id).gte("granted_at", previousPeriodEnd.toISOString());
          return secureResponse({
            total_cards: streamerData?.total_cards || 0,
            total_collectors: streamerData?.total_collectors || 0,
            total_packs_opened: streamerData?.total_packs_opened || 0,
            cards_change: 0,
            // Would calculate from previous period
            collectors_change: (currentCollectors.count || 0) - (previousCollectors.count || 0),
            packs_change: 0,
            // Would calculate from previous period
            growth_data: growthData
          }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/analytics/cards") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get("days") || "30");
          const { data: mostCollected } = await supabase.from("user_cards").select("card_id, cards(name, image_url, rarity)").eq("streamer_id", streamer.id).gte("granted_at", new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString());
          const cardCounts = {};
          mostCollected?.forEach((uc) => {
            const cardId = uc.card_id;
            if (!cardCounts[cardId]) {
              cardCounts[cardId] = {
                id: cardId,
                name: uc.cards?.name || "Unknown",
                image_url: uc.cards?.image_url || "/pack.png",
                rarity: uc.cards?.rarity || "common",
                collection_count: 0
              };
            }
            cardCounts[cardId].collection_count++;
          });
          const mostCollectedList = Object.values(cardCounts).sort((a, b) => b.collection_count - a.collection_count).slice(0, 10);
          const { data: allCards } = await supabase.from("cards").select("id, name, image_url, rarity").eq("streamer_id", streamer.id);
          const allCardIds = allCards?.map((c) => c.id) || [];
          const { data: allCollections } = await supabase.from("user_cards").select("card_id").eq("streamer_id", streamer.id).in("card_id", allCardIds);
          const collectionCounts = {};
          allCollections?.forEach((uc) => {
            collectionCounts[uc.card_id] = (collectionCounts[uc.card_id] || 0) + 1;
          });
          const rarestList = allCards?.map((card) => ({
            id: card.id,
            name: card.name,
            image_url: card.image_url,
            rarity: card.rarity,
            collection_count: collectionCounts[card.id] || 0
          })).sort((a, b) => a.collection_count - b.collection_count).slice(0, 10) || [];
          const communityDiscovery = { common: { total: 0, found: 0 }, rare: { total: 0, found: 0 }, epic: { total: 0, found: 0 }, legendary: { total: 0, found: 0 } };
          allCards?.forEach((card) => {
            const rarity = card.rarity?.toLowerCase() || "common";
            if (!communityDiscovery[rarity]) communityDiscovery[rarity] = { total: 0, found: 0 };
            communityDiscovery[rarity].total++;
            if (collectionCounts[card.id] > 0) {
              communityDiscovery[rarity].found++;
            }
          });
          return secureResponse({
            most_collected: mostCollectedList,
            rarest: rarestList,
            community_discovery: communityDiscovery
          }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/analytics/collectors") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get("days") || "30");
          const { data: userCards } = await supabase.from("user_cards").select("twitch_id, card_id, users(username)").eq("streamer_id", streamer.id);
          const collectorStats = {};
          userCards?.forEach((uc) => {
            const twitchId = uc.twitch_id;
            if (!collectorStats[twitchId]) {
              collectorStats[twitchId] = {
                twitch_id: twitchId,
                username: uc.users?.username || "Unknown",
                total_cards: 0,
                unique_cards: /* @__PURE__ */ new Set()
              };
            }
            collectorStats[twitchId].total_cards++;
            collectorStats[twitchId].unique_cards.add(uc.card_id);
          });
          const collectorsArray = Object.values(collectorStats);
          const topCollectors = collectorsArray.map((stat) => ({
            twitch_id: stat.twitch_id,
            username: stat.username,
            total_cards: stat.total_cards,
            unique_cards: stat.unique_cards.size
          })).sort((a, b) => b.total_cards - a.total_cards).slice(0, 10);
          const { count: totalUniqueCards } = await supabase.from("cards").select("*", { count: "exact", head: true }).eq("streamer_id", streamer.id);
          const totalCards = totalUniqueCards || 1;
          const totalCollectorsNum = collectorsArray.length;
          let avgCompletionRaw = 0;
          let top10CompletionRaw = 0;
          if (totalCollectorsNum > 0) {
            const sumUnique = collectorsArray.reduce((sum, stat) => sum + stat.unique_cards.size, 0);
            const avgUnique = sumUnique / totalCollectorsNum;
            avgCompletionRaw = avgUnique / totalCards * 100;
            const sortedByUnique = [...collectorsArray].sort((a, b) => b.unique_cards.size - a.unique_cards.size);
            const top10Count = Math.max(1, Math.ceil(totalCollectorsNum * 0.1));
            const top10Unique = sortedByUnique.slice(0, top10Count).reduce((sum, stat) => sum + stat.unique_cards.size, 0);
            top10CompletionRaw = top10Unique / top10Count / totalCards * 100;
          }
          return secureResponse({
            top_collectors: topCollectors,
            total_collectors: totalCollectorsNum,
            binder_completion: {
              average_completion_pct: Math.round(avgCompletionRaw),
              top_10_completion_pct: Math.round(top10CompletionRaw)
            }
          }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/validate-reward") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const rewardId = url.searchParams.get("reward_id");
          if (!rewardId) {
            return secureResponse({ valid: false, error: "No reward ID provided" }, 400, corsHeaders);
          }
          const isValidFormat = /^[a-f0-9]{36}$/i.test(rewardId);
          return secureResponse({
            valid: isValidFormat,
            error: isValidFormat ? null : "Invalid reward ID format"
          }, 200, corsHeaders);
        } catch (e) {
          return secureResponse({ valid: false, error: e.message }, 400, corsHeaders);
        }
      }
      if (method === "GET" && path === "/api/creator/webhook-status") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const hasWebhook = !!streamer.webhook_secret;
          const hasRewardId = !!streamer.twitch_reward_id;
          return secureResponse({
            status: hasWebhook && hasRewardId ? "active" : "inactive",
            has_webhook: hasWebhook,
            has_reward_id: hasRewardId
          }, 200, corsHeaders);
        } catch (e) {
          return secureResponse({ status: "error", error: e.message }, 400, corsHeaders);
        }
      }
      if (method === "POST" && path === "/api/creator/test-webhook") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          await logSystem(supabase, "info", "webhook", `Test webhook triggered for ${streamer.username}`, streamer.id);
          return secureResponse({ success: true, message: "Test webhook sent" }, 200, corsHeaders);
        } catch (e) {
          return secureResponse({ success: false, error: e.message }, 400, corsHeaders);
        }
      }
      if (method === "GET" && path === "/api/creator/webhook-events") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          return secureResponse([], 200, corsHeaders);
        } catch (e) {
          return secureResponse([], 200, corsHeaders);
        }
      }
      if (method === "GET" && path === "/api/creator/automation") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          return secureResponse({
            scheduled_drops_enabled: false,
            milestone_rewards_enabled: false,
            chat_command_enabled: false,
            chat_command: "!drop",
            scheduled_drops: []
          }, 200, corsHeaders);
        } catch (e) {
          return secureResponse({ error: e.message }, 400, corsHeaders);
        }
      }
      if (method === "POST" && path === "/api/creator/automation") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json();
          await logSystem(supabase, "info", "system", `Automation settings updated for ${streamer.username}`, streamer.id);
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse({ error: e.message }, 400, corsHeaders);
        }
      }
      if (method === "GET" && path === "/api/creator/analytics/overview") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get("days") || "30");
          const { count: totalPulls } = await supabase.from("user_cards").select("*", { count: "exact", head: true }).eq("streamer_id", streamer.id).gte("granted_at", new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString());
          const { count: newCollectors } = await supabase.from("user_cards").select("twitch_id", { count: "exact", head: true }).eq("streamer_id", streamer.id).gte("granted_at", new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString());
          const { count: activeSets } = await supabase.from("streamer_sets").select("*", { count: "exact", head: true }).eq("streamer_id", streamer.id).eq("is_active", true);
          return secureResponse({
            total_pulls: totalPulls || 0,
            new_collectors: newCollectors || 0,
            // This is simplified, should be distinct twitch_id
            active_sets: activeSets || 0,
            completion_rate: 0
            // Placeholder
          }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/creator/automation/milestone") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json();
          await logSystem(supabase, "info", "system", `Milestone reward set at ${b.followers} followers for ${streamer.username}`, streamer.id);
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse({ error: e.message }, 400, corsHeaders);
        }
      }
      if (method === "GET" && path === "/api/creator/settings") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          return secureResponse(streamer, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }
      if (method === "PATCH" && path === "/api/creator/settings") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json();
          const updateData = {};
          if (b.brand_name) updateData.brand_name = b.brand_name;
          if (b.brand_tagline !== void 0) updateData.brand_tagline = b.brand_tagline;
          if (b.pack_image_url) updateData.pack_image_url = b.pack_image_url;
          if (b.card_back_url) updateData.card_back_url = b.card_back_url;
          if (b.pack_open_sound_url) updateData.pack_open_sound_url = b.pack_open_sound_url;
          if (b.twitch_reward_id !== void 0) updateData.twitch_reward_id = b.twitch_reward_id;
          if (b.twitch_battle_reward_id !== void 0) updateData.twitch_battle_reward_id = b.twitch_battle_reward_id;
          if (b.battles_enabled !== void 0) updateData.battles_enabled = b.battles_enabled;
          if (b.trading_enabled !== void 0) updateData.trading_enabled = b.trading_enabled;
          if (b.binder_color !== void 0) updateData.binder_color = b.binder_color;
          const { data, error } = await supabase.from("streamers").update(updateData).eq("id", streamer.id).select().single();
          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/stats") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { count: cardCount } = await supabase.from("cards").select("*", { count: "exact", head: true }).eq("streamer_id", streamer.id);
          const { count: collectorCount } = await supabase.from("streamer_leaderboards").select("*", { count: "exact", head: true }).eq("streamer_id", streamer.id);
          return secureResponse({
            total_cards: cardCount || 0,
            community: collectorCount || 0,
            is_active: streamer.is_active
          }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/analytics/packs") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get("days") || "30");
          const { data: recentOpenings } = await supabase.from("user_cards").select("granted_at").eq("streamer_id", streamer.id).gte("granted_at", new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString()).order("granted_at", { ascending: true });
          const activityData = [];
          const startDate = /* @__PURE__ */ new Date();
          startDate.setDate(startDate.getDate() - days);
          for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split("T")[0];
            const dayOpenings = recentOpenings?.filter((o) => o.granted_at?.startsWith(dateStr)).length || 0;
            activityData.push({
              date: dateStr,
              count: dayOpenings
            });
          }
          return secureResponse({
            total_openings: recentOpenings?.length || 0,
            activity_data: activityData
          }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "POST" && path.startsWith("/api/creator/cards/") && path.endsWith("/assign-set")) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const cardId = path.split("/")[4];
          const b = await request.json();
          const { data: existingCard, error: cardErr } = await supabase.from("cards").select("id, streamer_id").eq("id", cardId).eq("streamer_id", streamer.id).single();
          if (cardErr || !existingCard) {
            return secureResponse("Card not found or access denied", 404, corsHeaders, true);
          }
          if (b.set_id) {
            const { data: existingSet, error: setErr } = await supabase.from("streamer_sets").select("id").eq("id", b.set_id).eq("streamer_id", streamer.id).single();
            if (setErr || !existingSet) {
              return secureResponse("Set not found or access denied", 404, corsHeaders, true);
            }
          }
          const { data, error: updateErr } = await supabase.from("cards").update({ set_id: b.set_id || null }).eq("id", cardId).select().single();
          if (updateErr) throw updateErr;
          if (b.set_id) {
            const { count } = await supabase.from("cards").select("*", { count: "exact", head: true }).eq("set_id", b.set_id);
            await supabase.from("streamer_sets").update({ total_cards: count || 0 }).eq("id", b.set_id);
          }
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/creator/events") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json();
          const durationHrs = Math.max(1, parseInt(b.duration || "1"));
          const startsAt = /* @__PURE__ */ new Date();
          const endsAt = new Date(startsAt.getTime() + durationHrs * 60 * 60 * 1e3);
          const rarity = b.target_rarity || "rare";
          const multiplier = parseFloat(b.multiplier || "2");
          const config = { common: 70, rare: 20, epic: 8, legendary: 2 };
          const baseWeight = config[rarity];
          const newWeight = Math.min(baseWeight * multiplier, 50);
          const diff = newWeight - baseWeight;
          config.common = Math.max(10, config.common - diff);
          config[rarity] = newWeight;
          const { data, error } = await supabase.from("streamer_events").insert({
            streamer_id: streamer.id,
            type: b.type || "rarity_boost",
            name: `${rarity.toUpperCase()} Protocol Boost`,
            config,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString()
          }).select().single();
          if (error) throw error;
          await logSystem(supabase, "info", "admin", `Special Event initiated: ${data.name}`, streamer.id);
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/events/active") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const { data, error } = await supabase.from("streamer_events").select("*").eq("streamer_id", streamer.id).eq("is_active", true).lte("starts_at", now).gte("ends_at", now).maybeSingle();
          if (error) throw error;
          return secureResponse(data || null, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "PUT" && path.startsWith("/api/creator/cards/")) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const cardId = path.split("/").pop();
          const b = await request.json();
          const { data: existingCard, error: checkErr } = await supabase.from("cards").select("id, streamer_id, image_url").eq("id", cardId).eq("streamer_id", streamer.id).single();
          if (checkErr || !existingCard) {
            return secureResponse("Card not found or access denied", 404, corsHeaders, true);
          }
          if (b.image_url && existingCard.image_url !== b.image_url) {
            const r2Key = getR2KeyFromImageUrl(existingCard.image_url);
            if (r2Key && env.CARD_IMAGES) {
              try {
                await env.CARD_IMAGES.delete(r2Key);
              } catch (_) {
              }
            }
          }
          const updateData = {};
          if (b.name) updateData.name = b.name;
          if (b.rarity) updateData.rarity = b.rarity;
          if (b.description !== void 0) updateData.description = b.description;
          if (b.attack !== void 0) updateData.attack = b.attack;
          if (b.defense !== void 0) updateData.defense = b.defense;
          if (b.image_url) updateData.image_url = b.image_url;
          if (b.set_id !== void 0) updateData.set_id = b.set_id;
          if (b.card_number !== void 0) updateData.card_number = b.card_number;
          if (b.is_battle_eligible !== void 0) updateData.is_battle_eligible = b.is_battle_eligible;
          if (b.is_trading_eligible !== void 0) updateData.is_trading_eligible = b.is_trading_eligible;
          const { data, error: updateErr } = await supabase.from("cards").update(updateData).eq("id", cardId).select().single();
          if (updateErr) throw updateErr;
          if (b.attack !== void 0 || b.defense !== void 0) {
            const syncData = {};
            if (b.attack !== void 0) syncData.attack = b.attack;
            if (b.defense !== void 0) {
              syncData.defense = b.defense;
              syncData.max_hp = b.defense;
            }
            await supabase.from("user_cards").update(syncData).eq("card_id", cardId);
          }
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "DELETE" && path.startsWith("/api/creator/cards/") && !path.endsWith("/assign-set")) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const cardId = path.split("/").pop();
          const { data: existingCard, error: checkErr } = await supabase.from("cards").select("id, streamer_id, image_url").eq("id", cardId).eq("streamer_id", streamer.id).single();
          if (checkErr || !existingCard) {
            return secureResponse("Card not found or access denied", 404, corsHeaders, true);
          }
          const r2Key = getR2KeyFromImageUrl(existingCard.image_url);
          if (r2Key && env.CARD_IMAGES) {
            try {
              await env.CARD_IMAGES.delete(r2Key);
            } catch (_) {
            }
          }
          const { error: deleteErr } = await supabase.from("cards").delete().eq("id", cardId);
          if (deleteErr) throw deleteErr;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/sets") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { data: sData, error: sErr } = await supabase.from("streamer_sets").select("*").eq("streamer_id", streamer.id).order("created_at", { ascending: false });
          if (sErr) throw sErr;
          return secureResponse(sData, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/cards") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { data, error } = await supabase.from("cards").select("*").eq("streamer_id", streamer.id).order("name", { ascending: true });
          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/creator/grant") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json();
          if (!b.twitch_id) throw new Error("Missing twitch_id");
          if (!b.card_id && !b.random_rarity) throw new Error("Missing card_id or random_rarity");
          const isRandom = b.card_id === "random";
          const forcedCardId = isRandom ? void 0 : b.card_id;
          const forcedRarity = isRandom ? b.random_rarity : void 0;
          await grantRandomCard(supabase, b.twitch_id, b.username || "System Grant", streamer.id, null, env, {
            forcedCardId,
            forcedRarity,
            isSilent: b.is_silent
          });
          const logMsg = forcedCardId ? `Creator granted specific card ${forcedCardId} to ${b.twitch_id}` : `Creator granted random ${forcedRarity || "any"} card to ${b.twitch_id}`;
          await logSystem(supabase, "info", "grant", logMsg, streamer.id);
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/creator/sets") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json();
          const setData = {
            streamer_id: streamer.id,
            name: b.name,
            code: b.code || b.name.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 10),
            description: b.description || null,
            total_cards: b.total_cards || 0
          };
          if (b.id) setData.id = b.id;
          if (b.icon_url) setData.icon_url = b.icon_url;
          if (b.release_date) setData.release_date = b.release_date;
          if (b.end_date) setData.end_date = b.end_date;
          if (b.is_active !== void 0) setData.is_active = b.is_active;
          const { data, error: setErr } = await supabase.from("streamer_sets").upsert(setData).select().single();
          if (setErr) throw setErr;
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "PUT" && path.startsWith("/api/creator/sets/")) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const setId = path.split("/").pop();
          const b = await request.json();
          const { data: existingSet, error: checkErr } = await supabase.from("streamer_sets").select("id").eq("id", setId).eq("streamer_id", streamer.id).single();
          if (checkErr || !existingSet) {
            return secureResponse("Set not found or access denied", 404, corsHeaders, true);
          }
          const updateData = {};
          if (b.name) updateData.name = b.name;
          if (b.code) updateData.code = b.code;
          if (b.description !== void 0) updateData.description = b.description;
          if (b.icon_url !== void 0) updateData.icon_url = b.icon_url;
          if (b.release_date !== void 0) updateData.release_date = b.release_date;
          if (b.end_date !== void 0) updateData.end_date = b.end_date;
          if (b.is_active !== void 0) updateData.is_active = b.is_active;
          const { data, error: updateErr } = await supabase.from("streamer_sets").update(updateData).eq("id", setId).select().single();
          if (updateErr) throw updateErr;
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "DELETE" && path.startsWith("/api/creator/sets/")) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const setId = path.split("/").pop();
          const { data: existingSet, error: checkErr } = await supabase.from("streamer_sets").select("id").eq("id", setId).eq("streamer_id", streamer.id).single();
          if (checkErr || !existingSet) {
            return secureResponse("Set not found or access denied", 404, corsHeaders, true);
          }
          const { error: deleteErr } = await supabase.from("streamer_sets").delete().eq("id", setId);
          if (deleteErr) throw deleteErr;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path.startsWith("/api/creator/sets/") && path.endsWith("/stats")) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const setId = path.split("/")[4];
          const { data: existingSet, error: checkErr } = await supabase.from("streamer_sets").select("id").eq("id", setId).eq("streamer_id", streamer.id).single();
          if (checkErr || !existingSet) {
            return secureResponse("Set not found or access denied", 404, corsHeaders, true);
          }
          const { count: cardCount } = await supabase.from("cards").select("*", { count: "exact", head: true }).eq("set_id", setId);
          const { data: setCards } = await supabase.from("cards").select("id").eq("set_id", setId);
          const cardIds = setCards?.map((c) => c.id) || [];
          let collectorCount = 0;
          if (cardIds.length > 0) {
            const { count } = await supabase.from("user_cards").select("twitch_id", { count: "exact", head: true }).in("card_id", cardIds);
            collectorCount = count || 0;
          }
          return secureResponse({
            card_count: cardCount || 0,
            collector_count: collectorCount || 0
          }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/admin/cards") {
        try {
          await checkAdmin(request);
          const { data, error } = await supabase.from("cards").select("*").order("id", { ascending: true });
          if (error) throw error;
          return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 401, headers: corsHeaders });
        }
      }
      if (method === "DELETE" && path === "/api/admin/cards") {
        try {
          await checkAdmin(request);
          const cardId = url.searchParams.get("card_id");
          if (!cardId) throw new Error("Missing card_id");
          const { error } = await supabase.from("cards").delete().eq("id", cardId);
          if (error) throw error;
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 401, headers: corsHeaders });
        }
      }
      if (method === "GET" && path === "/api/admin/stats") {
        try {
          await checkAdmin(request);
          const { count: userCount } = await supabase.from("users").select("*", { count: "exact", head: true });
          const { count: cardCount } = await supabase.from("user_cards").select("*", { count: "exact", head: true });
          const { count: uniqueCount } = await supabase.from("cards").select("*", { count: "exact", head: true });
          const { data: legendaryCards } = await supabase.from("cards").select("id").eq("rarity", "Legendary");
          const legendaryIds = legendaryCards?.map((c) => c.id) || [];
          const { count: legendaryCount } = await supabase.from("user_cards").select("*", { count: "exact", head: true }).in("card_id", legendaryIds);
          return new Response(JSON.stringify({
            total_users: userCount || 0,
            total_cards: cardCount || 0,
            unique_cards: uniqueCount || 0,
            legendary_count: legendaryCount || 0
          }), { status: 200, headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 401, headers: corsHeaders });
        }
      }
      if (method === "GET" && path === "/api/sets") {
        try {
          const { data, error } = await supabase.from("streamer_sets").select("*").order("release_date", { ascending: false });
          if (error) throw error;
          return new Response(JSON.stringify(data || []), { status: 200, headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: corsHeaders });
        }
      }
      if (method === "GET" && path === "/api/admin/sets") {
        try {
          await checkAdmin(request);
          const { data, error } = await supabase.from("streamer_sets").select("*").order("release_date", { ascending: false });
          if (error) throw error;
          return new Response(JSON.stringify(data || []), { status: 200, headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 401, headers: corsHeaders });
        }
      }
      if (method === "POST" && path === "/api/admin/sets") {
        try {
          await checkAdmin(request);
          const body = await request.json();
          const { error } = await supabase.from("streamer_sets").upsert({
            id: body.id,
            name: body.name,
            code: body.code,
            icon_url: body.icon_url,
            release_date: body.release_date,
            description: body.description,
            total_cards: body.total_cards || 0,
            card_back_url: body.card_back_url || null
          });
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || String(e) || "Validation failed", 400, corsHeaders, true);
        }
      }
      if (method === "PUT" && path.startsWith("/api/admin/sets/")) {
        try {
          await checkAdmin(request);
          const setId = url.pathname.split("/").pop();
          const body = await request.json();
          const { error } = await supabase.from("streamer_sets").update({
            name: body.name,
            code: body.code,
            icon_url: body.icon_url,
            release_date: body.release_date,
            description: body.description,
            total_cards: body.total_cards,
            card_back_url: body.card_back_url
          }).eq("id", setId);
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || String(e) || "Update failed", 400, corsHeaders, true);
        }
      }
      if (method === "DELETE" && path.startsWith("/api/admin/sets/")) {
        try {
          await checkAdmin(request);
          const setId = url.pathname.split("/").pop();
          const { count } = await supabase.from("cards").select("*", { count: "exact", head: true }).eq("set_id", setId);
          if (count && count > 0) {
            return secureResponse("Cannot delete set with existing cards", 400, corsHeaders, true);
          }
          const { error } = await supabase.from("streamer_sets").delete().eq("id", setId);
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || String(e) || "Delete failed", 400, corsHeaders, true);
        }
      }
      if (method === "DELETE" && path === "/api/admin/bulk/delete-all-cards") {
        try {
          await checkAdmin(request);
          const { error } = await supabase.from("user_cards").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          if (error) throw error;
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 401, headers: corsHeaders });
        }
      }
      if (method === "DELETE" && path === "/api/admin/bulk/delete-all-trades") {
        try {
          await checkAdmin(request);
          await supabase.from("trade_items").delete().neq("trade_id", "00000000-0000-0000-0000-000000000000");
          const { error } = await supabase.from("trades").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          if (error) throw error;
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 401, headers: corsHeaders });
        }
      }
      if (method === "GET" && path === "/api/admin/export") {
        try {
          await checkAdmin(request);
          const { data: users } = await supabase.from("users").select("*");
          const { data: cards } = await supabase.from("cards").select("*");
          const { data: userCards } = await supabase.from("user_cards").select("*");
          return secureResponse({
            exported_at: (/* @__PURE__ */ new Date()).toISOString(),
            users,
            cards,
            user_cards: userCards
          }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || String(e) || "Unauthorized", 401, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/me/streamers") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const { data, error } = await supabase.from("user_collection_by_streamer").select("*").eq("twitch_id", user.twitch_id);
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse(data, 200, corsHeaders);
      }
      if (method === "GET" && path === "/api/creator/profile") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse("Forbidden: No streamer record found for your Twitch account", 403, corsHeaders, true);
        return secureResponse(streamer, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/creator/settings") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse("Forbidden", 403, corsHeaders, true);
        try {
          const body = await request.json();
          const allowedFields = [
            "brand_name",
            "brand_tagline",
            "pack_image_url",
            "card_back_url",
            "pack_open_sound_url",
            "twitch_client_secret",
            "streamelements_jwt",
            "twitch_reward_id",
            "twitch_battle_reward_id"
          ];
          const updates = {};
          for (const field of allowedFields) {
            if (body[field] !== void 0) {
              if (["twitch_client_secret", "streamelements_jwt"].includes(field) && body[field]) {
                updates[field] = await encryptSensitive(body[field], env.SESSION_SECRET);
              } else {
                updates[field] = body[field];
              }
            }
          }
          updates.updated_at = (/* @__PURE__ */ new Date()).toISOString();
          const { error } = await supabase.from("streamers").update(updates).eq("id", streamer.id);
          if (error) throw error;
          await logSystem(supabase, "info", "admin", `Streamer @${streamer.username} updated brand settings`, streamer.id);
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || "Update failed", 500, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/creator/analytics") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse("Forbidden", 403, corsHeaders, true);
        const { data: analytics, error } = await supabase.from("streamer_analytics").select("*").eq("streamer_id", streamer.id).order("date", { ascending: false }).limit(30);
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse(analytics, 200, corsHeaders);
      }
      if (method === "GET" && path === "/api/creator/cards") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse("Forbidden", 403, corsHeaders, true);
        const { data: cards, error } = await supabase.from("cards").select("*").eq("streamer_id", streamer.id).order("card_number", { ascending: true });
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse(cards, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/creator/upload") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const formData = await request.formData();
          const file = formData.get("file");
          if (!file) return secureResponse("No file uploaded", 400, corsHeaders, true);
          if (file.size > CARD_IMAGE_MAX_BYTES) {
            return secureResponse(`File too large. Max ${CARD_IMAGE_MAX_BYTES / (1024 * 1024)}MB.`, 413, corsHeaders, true);
          }
          const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
          const ext = file.type === "image/webp" ? ".webp" : (file.name.match(/\.[^/.]+$/) || [".png"])[0];
          const fileName = `${streamer.id}/${Date.now()}-${baseName}${ext}`;
          const filePath = `${fileName}`;
          await env.CARD_IMAGES.put(filePath, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type || "image/webp" }
          });
          const publicUrl = `https://cdn.codeoce.com/${filePath}`;
          return secureResponse({ success: true, url: publicUrl }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || "Upload failed", 500, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/creator/onboarding/complete") {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const body = await request.json();
          const { identity, twitch, genesis } = body;
          const streamerUpdates = {
            brand_name: identity.collectionName,
            brand_tagline: identity.tagline,
            achievement_names: body.achievements || streamer.achievement_names,
            twitch_reward_id: twitch.rewardId || null,
            twitch_battle_reward_id: twitch.battleRewardId || null,
            is_active: true,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          const { error: streamerErr } = await supabase.from("streamers").update(streamerUpdates).eq("id", streamer.id);
          if (streamerErr) throw streamerErr;
          const { data: genSet, error: setErr } = await supabase.from("streamer_sets").upsert({
            streamer_id: streamer.id,
            name: "Genesis Set",
            code: "GENESIS",
            description: "The inaugural collection.",
            is_active: true
          }, { onConflict: "streamer_id, code" }).select().single();
          if (setErr) throw setErr;
          if (genesis && Array.isArray(genesis)) {
            const cardsToInsert = genesis.map((card, idx) => ({
              id: `${streamer.id}-genesis-${card.rarity}`,
              streamer_id: streamer.id,
              set_id: genSet.id,
              name: card.name,
              rarity: card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1),
              image_url: card.image_url || "/pack.png",
              is_approved: true,
              card_number: (idx + 1).toString()
            }));
            const { error: cardErr } = await supabase.from("cards").upsert(cardsToInsert);
            if (cardErr) throw cardErr;
          }
          await logSystem(supabase, "info", "admin", `Creator @${streamer.username} completed onboarding!`, streamer.id);
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          console.error("[Onboarding Complete] Error:", e);
          return secureResponse(e.message || "Onboarding completion failed", 500, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/streamers") {
        const { data: streamers, error: sErr } = await supabase.from("streamers").select("id, username, display_name, avatar_url").eq("is_active", true);
        if (sErr) return secureResponse("Database error", 500, corsHeaders, true);
        return secureResponse(streamers, 200, corsHeaders);
      }
      if (method === "GET" && path === "/api/streamer/config") {
        const streamerParam = url.searchParams.get("streamer");
        if (!streamerParam) return secureResponse("Missing streamer parameter", 400, corsHeaders, true);
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(streamerParam);
        let query = supabase.from("streamers").select("id, username, display_name, avatar_url");
        if (isUuid) {
          query = query.or(`id.eq.${streamerParam},username.eq.${streamerParam}`);
        } else {
          query = query.eq("username", streamerParam);
        }
        const { data: streamer, error } = await query.maybeSingle();
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        if (!streamer) return secureResponse("Streamer not found", 404, corsHeaders, true);
        return secureResponse(streamer, 200, corsHeaders);
      }
      if (method === "GET" && path === "/api/collection") {
        const user = await getUserFromSession(request, env, supabase);
        const streamerParam = url.searchParams.get("streamer") || url.searchParams.get("streamer_id");
        let targetTwitchId = user?.twitch_id;
        if (!user) {
          if (!streamerParam) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
          const { data: stUser } = await supabase.from("users").select("twitch_id").ilike("username", streamerParam).single();
          if (!stUser) return secureResponse("Streamer user not found", 404, corsHeaders, true);
          targetTwitchId = stUser.twitch_id;
        }
        let query = supabase.from("enriched_user_cards").select("*").eq("twitch_id", targetTwitchId);
        if (streamerParam !== "all") {
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse("Streamer context not found", 404, corsHeaders, true);
          query = query.eq("streamer_id", streamer.id);
        }
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) {
          console.error("DB Error:", error.message);
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
        return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
      }
      if (method === "GET" && path === "/api/cards/count") {
        const streamer = await resolveStreamerContext(request, supabase, url);
        let query = supabase.from("cards").select("*", { count: "exact", head: true });
        if (streamer) {
          query = query.eq("streamer_id", streamer.id);
        }
        const { count, error } = await query;
        if (error) {
          console.error("DB Error:", error.message);
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ count: count || 0 }), { status: 200, headers: corsHeaders });
      }
      if (method === "GET" && path === "/api/public/battle/initiate") {
        const challengerRaw = url.searchParams.get("challenger");
        const targetRaw = url.searchParams.get("target");
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return new Response("Streamer context not found", { status: 404 });
        console.log(`[BATTLE INIT] [${streamer.username}] Raw: challenger=${challengerRaw}, target=${targetRaw}`);
        if (!challengerRaw || !targetRaw) return new Response("Missing challenger or target", { status: 400 });
        const challenger = challengerRaw.replace(/^@/, "").trim();
        const target = targetRaw.replace(/^@/, "").trim();
        const { data: targetData } = await supabase.from("users").select("username, twitch_id").ilike("username", target).maybeSingle();
        if (!targetData) {
          return new Response(`@${challenger}, @${target} hasn't played streamcards tcg yet!`, { status: 200 });
        }
        const { count: tCardsCount } = await supabase.from("user_cards").select("*", { count: "exact", head: true }).eq("twitch_id", targetData.twitch_id).eq("streamer_id", streamer.id);
        if (!tCardsCount || tCardsCount < 3) {
          return new Response(`@${challenger}, @${targetData.username} doesn't have enough cards in @${streamer.username}'s collection to battle!`, { status: 200 });
        }
        const { data: challengerData } = await supabase.from("users").select("twitch_id, username").ilike("username", challenger).maybeSingle();
        if (!challengerData) {
          return new Response(`@${challenger}, you need to play streamcards tcg first!`, { status: 200 });
        }
        const { count: cCardsCount } = await supabase.from("user_cards").select("*", { count: "exact", head: true }).eq("twitch_id", challengerData.twitch_id).eq("streamer_id", streamer.id);
        if (!cCardsCount || cCardsCount < 3) {
          return new Response(`@${challengerData.username}, you need at least 3 cards from @${streamer.username} to battle!`, { status: 200 });
        }
        console.log(`[BATTLE INIT] Inserting: ${challengerData.username} vs ${targetData.username} for streamer ${streamer.username}`);
        const { error: insertError } = await supabase.from("battles").insert({
          streamer_id: streamer.id,
          challenger_id: challengerData.twitch_id,
          challenger_name: challengerData.username || challenger,
          target_name: targetData.username,
          status: "pending"
        });
        if (insertError) {
          console.error("Battle Init Error:", insertError);
          return new Response("Failed to initiate battle. Try again later.", { status: 500 });
        }
        return new Response(`@${targetData.username}, ${challengerData.username || challenger} has challenged you to a battle in @${streamer.username}'s stream! Type !accept in chat to fight!`, { status: 200 });
      }
      if (method === "GET" && path === "/api/public/battle/accept") {
        const userRaw = url.searchParams.get("user");
        if (!userRaw) return new Response("Missing user data", { status: 400 });
        const username = userRaw.replace("@", "").trim();
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return new Response("Streamer context not found", { status: 404 });
        const { data: battle, error: bErr } = await supabase.from("battles").select("*").ilike("target_name", username).eq("status", "pending").eq("streamer_id", streamer.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (!battle) {
          console.log(`[BATTLE ACCEPT] [${streamer.username}] No pending battle for ${username}`);
          return new Response(`@${username}, you don't have any pending battles in @${streamer.username}'s stream!`, { status: 200 });
        }
        console.log(`[BATTLE ACCEPT] Found battle: ID=${battle.id}, ChallengerID=${battle.challenger_id}, TargetName=${battle.target_name}`);
        const [{ data: targetUser }, { data: challengerUser }] = await Promise.all([
          supabase.from("users").select("username, twitch_id, avatar_url").ilike("username", username).single(),
          supabase.from("users").select("username, avatar_url").eq("twitch_id", battle.challenger_id).single()
        ]);
        if (!targetUser) return new Response(`@${username}, you aren't registered.`, { status: 200 });
        console.log(`[BATTLE ACCEPT] Users ready: Challenger=${challengerUser?.username}, Target=${targetUser.username}`);
        const [cDeck, tDeck] = await Promise.all([
          supabase.from("enriched_user_cards").select("name, image_url, attack, defense").eq("twitch_id", battle.challenger_id).eq("streamer_id", streamer.id).limit(100),
          supabase.from("enriched_user_cards").select("name, image_url, attack, defense").eq("twitch_id", targetUser.twitch_id).eq("streamer_id", streamer.id).limit(100)
        ]);
        if (!cDeck.data || !tDeck.data || cDeck.data.length < 3 || tDeck.data.length < 3) {
          await supabase.from("battles").update({ status: "rejected" }).eq("id", battle.id);
          return new Response(`Battle cancelled: Someone doesn't have enough cards.`, { status: 200 });
        }
        const mapCard = /* @__PURE__ */ __name((c) => ({
          name: c.name,
          image_url: c.image_url,
          attack: c.attack || 0,
          defense: c.defense || 0
        }), "mapCard");
        const shuffle = /* @__PURE__ */ __name((arr) => arr.sort(() => 0.5 - Math.random()), "shuffle");
        const challengerCards = shuffle(cDeck.data).slice(0, 3).map(mapCard);
        const targetCards = shuffle(tDeck.data).slice(0, 3).map(mapCard);
        let challengerWins = 0;
        let targetWins = 0;
        const rounds = [];
        const battleDataRounds = [];
        for (let i = 0; i < 3; i++) {
          const cCard = challengerCards[i];
          const tCard = targetCards[i];
          const cAtk = cCard.attack || 0;
          const cDef = cCard.defense || 0;
          const tAtk = tCard.attack || 0;
          const tDef = tCard.defense || 0;
          const cRemainingHealth = cDef - tAtk;
          const tRemainingHealth = tDef - cAtk;
          const cSurvived = cRemainingHealth > 0;
          const tSurvived = tRemainingHealth > 0;
          if (cSurvived && !tSurvived) challengerWins++;
          else if (tSurvived && !cSurvived) targetWins++;
          if (cSurvived && !tSurvived) rounds.push(`${cCard.name} beat ${tCard.name}`);
          else if (tSurvived && !cSurvived) rounds.push(`${tCard.name} beat ${cCard.name}`);
          else rounds.push(`${cCard.name} tied ${tCard.name}`);
          battleDataRounds.push({
            round: i + 1,
            challengerCard: cCard,
            targetCard: tCard,
            challengerDamageTaken: tAtk,
            targetDamageTaken: cAtk,
            challengerSurvived: cSurvived,
            targetSurvived: tSurvived,
            winner: cSurvived && !tSurvived ? "challenger" : tSurvived && !cSurvived ? "target" : "draw"
          });
        }
        let resultMsg = "";
        let overallWinner = "draw";
        if (challengerWins > targetWins) {
          resultMsg = `@${battle.challenger_name} WINS ${challengerWins}-${targetWins}!`;
          overallWinner = "challenger";
        } else if (targetWins > challengerWins) {
          resultMsg = `@${battle.target_name} WINS ${targetWins}-${challengerWins}!`;
          overallWinner = "target";
        } else {
          resultMsg = `It's a TIE ${challengerWins}-${targetWins}!`;
        }
        const battleData = {
          challenger: {
            id: battle.challenger_id,
            name: battle.challenger_name,
            avatar: challengerUser?.avatar_url,
            wins: challengerWins
          },
          target: {
            id: targetUser.twitch_id,
            name: battle.target_name,
            avatar: targetUser?.avatar_url,
            wins: targetWins
          },
          rounds: battleDataRounds,
          winner: overallWinner
        };
        await supabase.from("battles").update({
          status: "completed",
          completed_at: (/* @__PURE__ */ new Date()).toISOString(),
          battle_data: battleData
        }).eq("id", battle.id);
        const initStats = /* @__PURE__ */ __name(async (tId, uName) => {
          const { data } = await supabase.from("battle_stats").select("twitch_id").eq("twitch_id", tId).eq("streamer_id", streamer.id).maybeSingle();
          if (!data) await supabase.from("battle_stats").insert({ twitch_id: tId, username: uName, streamer_id: streamer.id });
        }, "initStats");
        await Promise.all([initStats(battle.challenger_id, battle.challenger_name), initStats(targetUser.twitch_id, battle.target_name)]);
        if (challengerWins > targetWins) {
          await supabase.rpc("increment_battle_stats", { p_winner_id: battle.challenger_id, p_loser_id: targetUser.twitch_id, p_streamer_id: streamer.id });
        } else if (targetWins > challengerWins) {
          await supabase.rpc("increment_battle_stats", { p_winner_id: targetUser.twitch_id, p_loser_id: battle.challenger_id, p_streamer_id: streamer.id });
        } else {
          await supabase.rpc("increment_battle_draws", { p_user1_id: battle.challenger_id, p_user2_id: targetUser.twitch_id, p_streamer_id: streamer.id });
        }
        const summary = `\u{1F4A5} BATTLE! ${resultMsg} (${rounds.join(" | ")})`;
        return new Response(summary, { status: 200 });
      }
      if (method === "GET" && path === "/api/public/battle/stats") {
        const userRaw = url.searchParams.get("user");
        if (!userRaw) return new Response("Missing user data", { status: 400 });
        const username = userRaw.replace("@", "").trim();
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return new Response("Streamer context not found", { status: 404 });
        const { data, error } = await supabase.from("battle_leaderboard").select("wins, losses, draws, win_rate").ilike("username", username).eq("streamer_id", streamer.id).maybeSingle();
        if (error || !data) {
          return new Response(`\u{1F3C6} @${username} hasn't fought any battles in @${streamer.username}'s stream yet!`, { status: 200 });
        }
        return new Response(`\u{1F3C6} @${username} Battle Record (@${streamer.username}): ${data.wins}W - ${data.losses}L - ${data.draws}D. (Win Rate: ${data.win_rate}%)`, { status: 200 });
      }
      if (method === "GET" && path === "/api/public/battle/latest") {
        const { data, error } = await supabase.from("battles").select("id, battle_data, completed_at").eq("status", "completed").not("battle_data", "is", null).order("completed_at", { ascending: false }).limit(1).maybeSingle();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        if (!data) return new Response(JSON.stringify(null), { status: 200, headers: corsHeaders });
        return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
      }
      if (method === "GET" && path === "/api/stats") {
        try {
          const user = await getUserFromSession(request, env, supabase);
          if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
          const streamerParam = url.searchParams.get("streamer");
          const isGlobal = streamerParam === "all";
          let streamer = null;
          if (!isGlobal) {
            streamer = await resolveStreamerContext(request, supabase, url);
            if (!streamer) return secureResponse("Streamer not found", 404, corsHeaders, true);
          }
          const twitchId = user.twitch_id;
          let totalQuery = supabase.from("user_cards").select("*", { count: "exact", head: true }).eq("twitch_id", twitchId);
          let legQuery = supabase.from("user_cards").select("card_id, cards!inner(rarity)").eq("twitch_id", twitchId);
          if (!isGlobal) {
            totalQuery = totalQuery.eq("streamer_id", streamer.id);
            legQuery = legQuery.eq("streamer_id", streamer.id);
          }
          const [{ count: totalCount, error: totalError }, { data: legendaryCards, error: legendaryError }] = await Promise.all([totalQuery, legQuery]);
          const legendaryCount = legendaryCards?.filter(
            (card) => card.cards?.rarity?.toLowerCase() === "legendary"
          ).length || 0;
          if (totalError || legendaryError) {
            console.error("[Stats] Error:", totalError || legendaryError);
            return secureResponse({ total: 0, legendary: 0 }, 200, corsHeaders);
          }
          const stats = {
            total: totalCount || 0,
            legendary: legendaryCount || 0
          };
          return secureResponse(stats, 200, corsHeaders);
        } catch (e) {
          console.error("[Stats] Exception:", e);
          return secureResponse({ total: 0, legendary: 0 }, 200, corsHeaders);
        }
      }
      if (method === "GET" && path === "/api/leaderboard") {
        try {
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse("Streamer not found", 404, corsHeaders, true);
          const { data, error } = await supabase.from("user_cards").select("twitch_id, users!inner(username, avatar_url)").eq("streamer_id", streamer.id).order("created_at", { ascending: false });
          if (error) {
            console.error("Leaderboard Error:", error.message);
            return secureResponse("Database error: " + error.message, 500, corsHeaders, true);
          }
          const leaderboardMap = /* @__PURE__ */ new Map();
          data?.forEach((card) => {
            const twitchId = card.twitch_id;
            if (!leaderboardMap.has(twitchId)) {
              leaderboardMap.set(twitchId, {
                twitch_id: twitchId,
                username: card.users?.username || "Unknown",
                avatar_url: card.users?.avatar_url || null,
                total_cards: 0
              });
            }
            leaderboardMap.get(twitchId).total_cards++;
          });
          const leaderboard = Array.from(leaderboardMap.values()).sort((a, b) => b.total_cards - a.total_cards).slice(0, 100);
          return secureResponse(leaderboard, 200, corsHeaders);
        } catch (e) {
          console.error("Leaderboard Exception:", e);
          return secureResponse("Error: " + e.message, 500, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/achievements") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse("Streamer not found", 404, corsHeaders, true);
        const twitchId = user.twitch_id;
        const customNames = streamer.achievement_names || {};
        const { data: allAchievements } = await supabase.from("achievements").select("*");
        const { data: userAchievements } = await supabase.from("user_achievements").select("achievement_id, unlocked_at").eq("twitch_id", twitchId).eq("streamer_id", streamer.id);
        const unlockedIds = new Set(userAchievements?.map((a) => a.achievement_id) || []);
        if (unlockedIds.size === 0) {
          const { count: cardCount } = await supabase.from("user_cards").select("*", { count: "exact", head: true }).eq("twitch_id", twitchId).eq("streamer_id", streamer.id);
          if (cardCount && cardCount > 0) {
            console.log(`[Achievements] Auto-syncing for ${twitchId} (0 achievements but ${cardCount} cards)`);
            syncUserAchievements(supabase, twitchId, streamer.id);
          }
        }
        const idToKeyMap = {
          "first_card": "beginner",
          "collector_10": "hoarder",
          "rare_finder": "rare",
          "epic_moment": "epic",
          "legendary_luck": "legendary",
          "completionist": "completionist",
          "set_collector": "traveler",
          "rarity_streak_3": "streak",
          "trader_debut": "trader"
        };
        const result = allAchievements?.map((ach) => {
          const customKey = idToKeyMap[ach.id];
          const customName = customKey ? customNames[customKey] : null;
          return {
            ...ach,
            name: customName || ach.name,
            // Use custom name if exists, else default
            unlocked: unlockedIds.has(ach.id),
            unlocked_at: userAchievements?.find((ua) => ua.achievement_id === ach.id)?.unlocked_at
          };
        }) || [];
        return secureResponse(result, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/achievements/sync") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse("Streamer not found", 404, corsHeaders, true);
        const result = await syncUserAchievements(supabase, user.twitch_id, streamer.id);
        return secureResponse(result, 200, corsHeaders);
      }
      if (method === "GET" && path === "/api/creator/stats") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse("Not a registered creator", 403, corsHeaders, true);
        const stats = {
          minted: 1337,
          packs: 0,
          community: 420
        };
        return new Response(JSON.stringify(stats), { status: 200, headers: corsHeaders });
      }
      if (method === "POST" && path === "/api/creator/cards") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse("Not a registered creator", 403, corsHeaders, true);
        const body = await request.json();
        if (!body.name || !body.rarity) return secureResponse("Missing card data", 400, corsHeaders, true);
        return secureResponse({ success: true, message: `Card ${body.name} minted!` }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/creator/packs") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse("Not a registered creator", 403, corsHeaders, true);
        const body = await request.json();
        if (!body.name) return secureResponse("Missing pack data", 400, corsHeaders, true);
        return secureResponse({ success: true, message: `Pack ${body.name} assembled!` }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/creator/drops") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse("Unauthorized", 401, corsHeaders, true);
        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse("Not a registered creator", 403, corsHeaders, true);
        return secureResponse({ success: true, message: `Live Drop sequence initiated in Twitch Chat!` }, 200, corsHeaders);
      }
      if (method === "GET" && path === "/api/admin/audit") {
        try {
          await checkAdmin(request);
          const search = url.searchParams.get("search")?.toLowerCase();
          const category = url.searchParams.get("category");
          return secureResponse([], 200, corsHeaders);
        } catch (e) {
          console.error("[Logs] Fatal Error:", e);
          const msg = e instanceof Error ? e.message || String(e) : String(e);
          const isAuth = msg.includes("Unauthorized");
          return secureResponse(msg || "Server error", isAuth ? 401 : 500, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/auth/twitch") {
        const role = url.searchParams.get("role") || "viewer";
        const origin2 = new URL(request.url).origin;
        const redirectUri = `${origin2}/auth/callback`;
        const state = encodeURIComponent(JSON.stringify({ role }));
        const baseScopes = ["user:read:email", "user:read:follows"];
        const creatorScopes = ["channel:manage:redemptions", "channel:read:redemptions"];
        const scopes = role === "creator" ? [...baseScopes, ...creatorScopes] : baseScopes;
        const scopeParam = encodeURIComponent(scopes.join(" "));
        const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${env.TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopeParam}&state=${state}`;
        return Response.redirect(authUrl, 302);
      }
      if (method === "GET" && path === "/api/admin/config") {
        try {
          await checkAdmin(request);
          const { data, error } = await supabase.from("system_config").select("*");
          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || "Unauthorized", 401, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/api/admin/config") {
        try {
          await checkAdmin(request);
          const body = await request.json();
          const { error } = await supabase.from("system_config").upsert({
            id: body.id,
            data: body.data,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          });
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e) {
          return secureResponse(e.message || "Unauthorized", 401, corsHeaders, true);
        }
      }
      if (method === "GET" && path === "/api/config/visuals") {
        const { data, error } = await supabase.from("system_config").select("data").eq("id", "visuals").single();
        if (error) return secureResponse({ error: error.message }, 500, corsHeaders);
        return secureResponse(data?.data || {}, 200, corsHeaders);
      }
      if (method === "GET" && path === "/auth/callback") {
        const code = url.searchParams.get("code");
        const stateParam = url.searchParams.get("state");
        if (!code) return new Response("No code", { status: 400 });
        let role = "viewer";
        try {
          if (stateParam) {
            const parsed = JSON.parse(decodeURIComponent(stateParam));
            if (parsed.role) role = parsed.role;
          }
        } catch (e) {
        }
        const origin2 = new URL(request.url).origin;
        const redirectUri = `${origin2}/auth/callback`;
        const tokenResp = await fetch("https://id.twitch.tv/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env.TWITCH_CLIENT_ID,
            client_secret: env.TWITCH_CLIENT_SECRET,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri
          })
        });
        const tokenData = await tokenResp.json();
        console.log(`[Auth/Callback] Token exchange status: ${tokenResp.status}, Has Access Token: ${!!tokenData.access_token}`);
        if (!tokenData.access_token) {
          console.error("[Auth/Callback] Exchange failed:", tokenData);
          return new Response("Auth Failed: No Access Token", { status: 401 });
        }
        const userResp = await fetch("https://api.twitch.tv/helix/users", {
          headers: { "Client-ID": env.TWITCH_CLIENT_ID, "Authorization": `Bearer ${tokenData.access_token}` }
        });
        const userData = await userResp.json();
        const user = userData.data[0];
        const encryptedAccess = await encryptSensitive(tokenData.access_token, env.SESSION_SECRET);
        const encryptedRefresh = tokenData.refresh_token ? await encryptSensitive(tokenData.refresh_token, env.SESSION_SECRET) : null;
        const tokenScope = Array.isArray(tokenData.scope) ? tokenData.scope.join(" ") : tokenData.scope || null;
        const { error: userErr } = await supabase.from("users").upsert({
          twitch_id: user.id,
          username: user.display_name,
          avatar_url: user.profile_image_url,
          is_linked: true,
          twitch_access_token_encrypted: encryptedAccess,
          twitch_refresh_token_encrypted: encryptedRefresh,
          twitch_token_scope: tokenScope
        }, { onConflict: "twitch_id" });
        if (userErr) console.error("[Auth/Callback] Users Upsert Error:", userErr);
        if (role === "creator") {
          const { error: streamerErr } = await supabase.from("streamers").upsert({
            twitch_id: user.id,
            username: user.display_name.toLowerCase(),
            display_name: user.display_name,
            avatar_url: user.profile_image_url,
            brand_name: user.display_name,
            twitch_access_token_encrypted: encryptedAccess,
            twitch_refresh_token_encrypted: encryptedRefresh,
            twitch_token_scope: tokenScope
          }, { onConflict: "twitch_id" });
          if (streamerErr) console.error("[Auth/Callback] Streamers Upsert Error:", streamerErr);
        }
        const { data: pending } = await supabase.from("pending_rewards").select("card_id, streamer_id, is_obs_consumed, cards!inner(rarity, attack, defense, mechanic_id)").eq("twitch_id", user.id);
        if (pending && pending.length > 0) {
          console.log(`[Auth] Claiming ${pending.length} cards for ${user.display_name}`);
          const toInsert = [];
          for (const p of pending) {
            const cardData = Array.isArray(p.cards) ? p.cards[0] : p.cards;
            toInsert.push({
              twitch_id: user.id,
              card_id: p.card_id,
              streamer_id: p.streamer_id,
              granted_by_streamer: p.streamer_id,
              is_obs_consumed: p.is_obs_consumed,
              attack: cardData?.attack || 0,
              defense: cardData?.defense || 0,
              max_hp: cardData?.defense || 0,
              mechanic_id: cardData?.mechanic_id || null
            });
          }
          await supabase.from("user_cards").insert(toInsert);
          await supabase.from("pending_rewards").delete().eq("twitch_id", user.id);
        }
        if (!user || !user.id) {
          console.error("[Auth/Callback] User data missing ID:", user);
          return new Response("Auth Failed: No User ID", { status: 401 });
        }
        const { data: streamer } = await supabase.from("streamers").select("id").eq("id", user.id).maybeSingle();
        const sessionToken = await new SignJWT({
          sub: user.id,
          twitch_id: user.id,
          username: user.display_name,
          is_creator: !!streamer
        }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id.toString()).setIssuedAt().setExpirationTime("7d").sign(new TextEncoder().encode(env.SESSION_SECRET));
        console.log(`[Auth/Callback] Token generated for ${user.display_name} (ID: ${user.id})`);
        const isHttps = request.url.startsWith("https");
        const secureFlag = isHttps ? "; Secure" : "";
        const requestOrigin = new URL(request.url).origin;
        console.log(`[Auth/Callback] User authenticated: ${user.display_name} (${user.id}), Role: ${role}`);
        let destination = requestOrigin;
        if (role === "creator") {
          destination = `${requestOrigin}/onboarding?role=creator`;
        } else {
          const { data: dbUser } = await supabase.from("users").select("is_onboarding_complete").eq("twitch_id", user.id).maybeSingle();
          if (!dbUser || !dbUser.is_onboarding_complete) {
            destination = `${requestOrigin}/onboarding?role=collector`;
          }
        }
        console.log(`[Auth/Callback] Redirecting to: ${destination}`);
        return new Response(null, {
          status: 302,
          headers: {
            "Location": destination,
            "Set-Cookie": `session=${sessionToken}; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=604800`
          }
        });
      }
      async function verifyOBSToken(streamerParam, tokenParam) {
        if (!streamerParam || !tokenParam) {
          console.log("[verifyOBSToken] Missing params:", { streamerParam: !!streamerParam, tokenParam: !!tokenParam });
          return null;
        }
        console.log("[verifyOBSToken] Verifying token for streamer:", streamerParam);
        let { data: streamer, error: streamerError } = await supabase.from("streamers").select("id, username, obs_overlay_token").ilike("username", streamerParam).maybeSingle();
        if (!streamer && streamerParam !== streamerParam.toLowerCase()) {
          const { data: lowerData } = await supabase.from("streamers").select("id, username, obs_overlay_token").eq("username", streamerParam.toLowerCase()).maybeSingle();
          if (lowerData) streamer = lowerData;
        }
        if (streamerError) {
          console.error("[verifyOBSToken] Database error:", streamerError);
          return null;
        }
        if (!streamer) {
          console.error("[verifyOBSToken] Streamer not found:", streamerParam);
          return null;
        }
        const storedToken = (streamer.obs_overlay_token || "").trim();
        const providedToken = (tokenParam || "").trim();
        console.log("[verifyOBSToken] Stored token (first 8):", storedToken.substring(0, 8));
        console.log("[verifyOBSToken] Provided token (first 8):", providedToken.substring(0, 8));
        console.log("[verifyOBSToken] Tokens match:", storedToken === providedToken);
        if (!storedToken || storedToken !== providedToken) {
          console.error("[verifyOBSToken] Token mismatch!");
          return null;
        }
        console.log("[verifyOBSToken] Token verified successfully");
        return streamer;
      }
      __name(verifyOBSToken, "verifyOBSToken");
      if (method === "GET" && url.pathname === "/api/obs/next") {
        const twitchId = url.searchParams.get("twitch_id");
        const streamerParam = url.searchParams.get("streamer");
        const tokenParam = url.searchParams.get("token");
        let streamer = null;
        if (streamerParam && tokenParam) {
          streamer = await verifyOBSToken(streamerParam, tokenParam);
          if (!streamer) {
            return new Response(JSON.stringify({ error: "Invalid token or streamer" }), { status: 403, headers: corsHeaders });
          }
        } else if (twitchId) {
          const { data: s } = await supabase.from("streamers").select("id").eq("twitch_id", twitchId).single();
          if (!s) {
            return new Response(JSON.stringify({ error: "Streamer not found" }), { status: 404, headers: corsHeaders });
          }
          streamer = s;
        } else {
          return new Response(JSON.stringify({ error: "Missing streamer/token or twitch_id" }), { status: 400, headers: corsHeaders });
        }
        const { data: userCard, error } = await supabase.from("user_cards").select("id, card_id, twitch_id, cards(id, name, rarity, image_url), users(username)").eq("streamer_id", streamer.id).eq("is_obs_consumed", false).order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (error) {
          console.error("[OBS] DB Error:", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
        if (!userCard) return new Response(JSON.stringify({ cards: null }), { status: 200, headers: corsHeaders });
        const card = userCard.cards;
        const user = userCard.users;
        const payload = {
          user_card_id: userCard.id,
          card_id: card?.id,
          name: card?.name,
          rarity: card?.rarity,
          image_url: card?.image_url,
          username: user?.username || null
        };
        return new Response(JSON.stringify({ cards: payload }), { status: 200, headers: corsHeaders });
      }
      if (method === "POST" && url.pathname === "/api/obs/consume") {
        const twitchId = url.searchParams.get("twitch_id");
        const streamerParam = url.searchParams.get("streamer");
        const tokenParam = url.searchParams.get("token");
        const cardId = url.searchParams.get("id");
        let streamer = null;
        if (streamerParam && tokenParam) {
          streamer = await verifyOBSToken(streamerParam, tokenParam);
          if (!streamer) {
            return new Response(JSON.stringify({ error: "Invalid token or streamer" }), { status: 403, headers: corsHeaders });
          }
        } else {
          return new Response(JSON.stringify({ error: "Authentication required: provide streamer and token parameters" }), { status: 400, headers: corsHeaders });
        }
        let targetId = cardId;
        if (!targetId) {
          const { data: oldest, error: findError } = await supabase.from("user_cards").select("id").eq("streamer_id", streamer.id).eq("is_obs_consumed", false).order("created_at", { ascending: true }).limit(1).maybeSingle();
          if (findError || !oldest) {
            return new Response(JSON.stringify({ success: false }), { status: 200, headers: corsHeaders });
          }
          targetId = oldest.id;
        }
        console.log(`[OBS] Consume requested \u2014 streamer=${streamer.id} id=${cardId} \u2192 targetId=${targetId}`);
        const { data: updateData, error: updateError, count } = await supabase.from("user_cards").update({ is_obs_consumed: true }).eq("id", targetId).eq("streamer_id", streamer.id).select("id");
        if (updateError) {
          console.error("[OBS] Update Error:", updateError);
          return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: corsHeaders });
        }
        console.log(`[OBS] Consumed ${updateData?.length ?? 0} row(s) for id=${targetId}`);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      }
      if (method === "GET" && path === "/api/public/battle/latest") {
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: "Streamer not found" }, 404, corsHeaders, true);
        const { data: battle, error } = await supabase.from("battles").select("id, battle_data, completed_at, challenger_name, target_name, winner_id").eq("streamer_id", streamer.id).not("battle_data", "is", null).order("completed_at", { ascending: false }).limit(1).maybeSingle();
        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse(battle || null, 200, corsHeaders);
      }
      if (method === "GET" && path === "/api/battle/saved-decks") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: "Unauthorized" }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: "Streamer not found" }, 404, corsHeaders, true);
        const { data: savedDecks, error } = await supabase.from("user_saved_decks").select(`
            id, name,
            slot_1_card_id, slot_2_card_id, slot_3_card_id,
            slot_1:slot_1_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
            slot_2:slot_2_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
            slot_3:slot_3_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity))
          `).eq("twitch_id", user.twitch_id).eq("streamer_id", streamer.id).order("name");
        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse({ decks: savedDecks || [] }, 200, corsHeaders);
      }
      if (method === "GET" && path === "/api/battle/deck") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: "Unauthorized" }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: "Streamer not found" }, 404, corsHeaders, true);
        const { data: deck, error } = await supabase.from("user_saved_decks").select(`
            id, name, is_active,
            slot_1_card_id, slot_2_card_id, slot_3_card_id,
            slot_1:slot_1_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
            slot_2:slot_2_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
            slot_3:slot_3_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity))
          `).eq("twitch_id", user.twitch_id).eq("streamer_id", streamer.id).eq("is_active", true).maybeSingle();
        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse({ deck: deck || null }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/battle/deck") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: "Unauthorized" }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: "Streamer not found" }, 404, corsHeaders, true);
        const body = await request.json();
        const { slot_1, slot_2, slot_3 } = body;
        const slotIds = [slot_1, slot_2, slot_3].filter(Boolean);
        if (slotIds.length === 0) return secureResponse({ error: "Provide at least one card slot" }, 400, corsHeaders, true);
        if (slotIds.length > 0) {
          const { data: owned } = await supabase.from("user_cards").select("id").in("id", slotIds).eq("twitch_id", user.twitch_id).eq("streamer_id", streamer.id);
          if (!owned || owned.length !== slotIds.length) {
            return secureResponse({ error: "One or more cards do not belong to you" }, 403, corsHeaders, true);
          }
        }
        await supabase.from("user_saved_decks").update({ is_active: false }).eq("twitch_id", user.twitch_id).eq("streamer_id", streamer.id);
        const { data: deck, error } = await supabase.from("user_saved_decks").upsert({
          twitch_id: user.twitch_id,
          streamer_id: streamer.id,
          name: "Current Deck",
          slot_1_card_id: slot_1 || null,
          slot_2_card_id: slot_2 || null,
          slot_3_card_id: slot_3 || null,
          is_active: true,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, { onConflict: "twitch_id,streamer_id,name" }).select().single();
        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse({ deck }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/battle/saved-decks") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: "Unauthorized" }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: "Streamer not found" }, 404, corsHeaders, true);
        const body = await request.json();
        if (body.action === "delete") {
          if (!body.id) return secureResponse({ error: "Deck ID required for deletion" }, 400, corsHeaders, true);
          const { error: delError } = await supabase.from("user_saved_decks").delete().eq("id", body.id).eq("twitch_id", user.twitch_id);
          if (delError) return secureResponse({ error: delError.message }, 500, corsHeaders, true);
          return secureResponse({ success: true }, 200, corsHeaders);
        }
        const { name, slot_1, slot_2, slot_3 } = body;
        if (!name || name.trim() === "") return secureResponse({ error: "Deck name is required" }, 400, corsHeaders, true);
        const slotIds = [slot_1, slot_2, slot_3].filter(Boolean);
        if (slotIds.length === 0) return secureResponse({ error: "Provide at least one card slot" }, 400, corsHeaders, true);
        const { data: owned } = await supabase.from("user_cards").select("id").in("id", slotIds).eq("twitch_id", user.twitch_id).eq("streamer_id", streamer.id);
        if (!owned || owned.length !== slotIds.length) {
          return secureResponse({ error: "One or more cards do not belong to you" }, 403, corsHeaders, true);
        }
        const { data: newDeck, error: saveError } = await supabase.from("user_saved_decks").insert({
          twitch_id: user.twitch_id,
          streamer_id: streamer.id,
          name: name.trim(),
          slot_1_card_id: slot_1 || null,
          slot_2_card_id: slot_2 || null,
          slot_3_card_id: slot_3 || null
        }).select().single();
        if (saveError) {
          if (saveError.code === "23505") {
            return secureResponse({ error: "A deck with this name already exists" }, 400, corsHeaders, true);
          }
          return secureResponse({ error: saveError.message }, 500, corsHeaders, true);
        }
        return secureResponse({ deck: newDeck }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/battle/saved-decks/activate") {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: "Unauthorized" }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: "Streamer not found" }, 404, corsHeaders, true);
        const body = await request.json();
        const { id } = body;
        if (!id) return secureResponse({ error: "Deck ID required" }, 400, corsHeaders, true);
        await supabase.from("user_saved_decks").update({ is_active: false }).eq("twitch_id", user.twitch_id).eq("streamer_id", streamer.id);
        const { data: deck, error } = await supabase.from("user_saved_decks").update({ is_active: true }).eq("id", id).eq("twitch_id", user.twitch_id).select().single();
        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse({ success: true, deck }, 200, corsHeaders);
      }
      if (method === "POST" && path === "/api/battle/initiate") {
        try {
          const user = await getUserFromSession(request, env, supabase);
          if (!user) return secureResponse({ error: "Unauthorized" }, 401, corsHeaders, true);
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse({ error: "Streamer not found" }, 404, corsHeaders, true);
          const { data: deck, error: deckErr } = await supabase.from("user_saved_decks").select(`
              slot_1:slot_1_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
              slot_2:slot_2_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
              slot_3:slot_3_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity))
            `).eq("twitch_id", user.twitch_id).eq("streamer_id", streamer.id).eq("is_active", true).maybeSingle();
          if (deckErr) {
            console.error("[BattleInitiate] Deck retrieval error:", deckErr.message);
            return secureResponse({ error: `Deck Error: ${deckErr.message}` }, 500, corsHeaders, true);
          }
          if (!deck || !deck.slot_1 && !deck.slot_2 && !deck.slot_3) {
            return secureResponse({ error: "Your deck is empty! Add cards first." }, 400, corsHeaders, true);
          }
          const { data: opponentDeck } = await supabase.from("user_saved_decks").select(`
              *, users!inner(username, avatar_url)
            `).not("slot_1", "is", null).not("slot_2", "is", null).not("slot_3", "is", null).neq("twitch_id", user.twitch_id).eq("streamer_id", streamer.id).limit(10);
          let targetDeck = null;
          let opponent = null;
          if (opponentDeck && opponentDeck.length > 0) {
            const randOpp = opponentDeck[Math.floor(Math.random() * opponentDeck.length)];
            targetDeck = randOpp;
            opponent = {
              id: randOpp.twitch_id,
              username: randOpp.users?.username || "Random Trainer",
              avatar: randOpp.users?.avatar_url || null
            };
            console.log(`[BATTLE] Using user deck from ${opponent.username}`);
          } else {
            let { data: globalPool } = await supabase.from("user_cards").select("*, card:cards(*), mechanic:mechanics(*)").limit(100);
            if (!globalPool || globalPool.length === 0) {
              const { data: fallbackPool } = await supabase.from("cards").select("*").limit(20);
              globalPool = (fallbackPool || []).map((c) => ({
                id: c.id,
                card: c,
                attack: c.attack || c.base_attack || Math.floor(Math.random() * 5) + 1,
                defense: c.defense || c.base_defense || Math.floor(Math.random() * 5) + 2,
                max_hp: c.max_hp || c.defense || 5
              }));
            }
            const cardsPool = globalPool || [];
            console.log(`[BATTLE] Generating Bot Master deck from user_cards. Pool size: ${cardsPool.length}`);
            const { data: allMechanics } = await supabase.from("mechanics").select("*");
            const getRandMech = /* @__PURE__ */ __name(() => {
              if (!allMechanics || allMechanics.length === 0) return null;
              return allMechanics[Math.floor(Math.random() * allMechanics.length)];
            }, "getRandMech");
            const getRandCard = /* @__PURE__ */ __name(() => {
              if (!cardsPool || cardsPool.length === 0) return null;
              const rc = cardsPool[Math.floor(Math.random() * cardsPool.length)];
              if (!rc.mechanic && !rc.mechanic_name) {
                const m = getRandMech();
                rc.mechanic = m;
                rc.mechanic_name = m?.name;
                rc.mechanic_icon = m?.icon;
              }
              return rc;
            }, "getRandCard");
            const card1 = getRandCard();
            const card2 = getRandCard() || card1;
            const card3 = getRandCard() || card1;
            targetDeck = {
              slot_1: card1,
              slot_2: card2,
              slot_3: card3
            };
            opponent = {
              id: null,
              username: `Bot Master`,
              avatar: `https://api.dicebear.com/9.x/bottts/svg?seed=BotMaster`
            };
            console.log(`[BATTLE] Bot Master deck slots:`, { s1: !!targetDeck.slot_1, s2: !!targetDeck.slot_2, s3: !!targetDeck.slot_3 });
          }
          const mapToEngine = /* @__PURE__ */ __name((s, slotNum) => {
            const mechName = s.mechanic_name || s.mechanic?.name || s.mechanic?.display_name || null;
            const mechIcon = s.mechanic_icon || s.mechanic?.icon || "";
            const genesisMechName = s.genesis_mechanic?.name || null;
            const genesisMechIcon = s.genesis_mechanic?.icon || "";
            return {
              id: s.id,
              name: s.card?.name || "Unknown",
              image_url: s.card?.image_url || "",
              mechanic_name: mechName,
              mechanic_icon: mechIcon,
              genesis_mechanic_name: genesisMechName,
              genesis_mechanic_icon: genesisMechIcon,
              attack: s.attack || 0,
              defense: s.defense || 0,
              max_hp: s.max_hp || s.defense || 0,
              slot: slotNum
            };
          }, "mapToEngine");
          const cDeck = [deck.slot_1, deck.slot_2, deck.slot_3].filter(Boolean).map((s, i) => mapToEngine(s, i + 1));
          const tDeck = [targetDeck.slot_1, targetDeck.slot_2, targetDeck.slot_3].filter(Boolean).map((s, i) => mapToEngine(s, i + 1));
          console.log(`[BATTLE] Challenger: ${cDeck.length} cards | Target: ${tDeck.length} cards`);
          const battle_data = runBattleEngine(
            { name: user.username, avatar: user.avatar_url, twitch_id: user.twitch_id },
            { name: opponent.username, avatar: opponent.avatar, twitch_id: opponent.id || "bot" },
            cDeck,
            tDeck
          );
          const { data: battle, error: bErr } = await supabase.from("battles").insert({
            streamer_id: streamer.id,
            challenger_id: user.twitch_id,
            target_id: opponent.id,
            // now null for bots to avoid FK violation
            challenger_name: user.username,
            target_name: opponent.username,
            winner_id: battle_data.winner === "challenger" ? user.twitch_id : battle_data.winner === "target" ? opponent.id : null,
            battle_data,
            completed_at: (/* @__PURE__ */ new Date()).toISOString(),
            status: "completed"
          }).select().single();
          if (bErr) {
            console.error("[BattleInitiate] Save battle error:", bErr.message);
            return secureResponse({ error: `Save Battle Error: ${bErr.message}` }, 500, corsHeaders, true);
          }
          return secureResponse({ success: true, battle }, 200, corsHeaders);
        } catch (e) {
          console.error("[BattleInitiate] Fatal error:", e.message);
          return secureResponse({ error: `Server Error: ${e.message}` }, 500, corsHeaders, true);
        }
      }
      if (method === "POST" && path === "/twitch/eventsub") {
        return handleTwitchWebhook(request, env);
      }
      if (env.ASSETS) {
        const assetRes = await env.ASSETS.fetch(request.clone());
        if (assetRes.ok) return assetRes;
        if (!path.includes(".")) {
          if (path === "/onboarding/test") {
            const testRes = await env.ASSETS.fetch(new Request(`${url.origin}/onboarding-test.html`));
            if (testRes.ok) {
              return new Response(testRes.body, {
                status: 200,
                headers: { "Content-Type": "text/html", ...corsHeaders }
              });
            }
          }
          if (path === "/dashboard") {
            const dashRes = await env.ASSETS.fetch(new Request(`${url.origin}/dashboard.html`));
            if (dashRes.ok) {
              return new Response(dashRes.body, {
                status: 200,
                headers: { "Content-Type": "text/html", ...corsHeaders }
              });
            }
          }
          const indexRes = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`));
          if (indexRes.ok) {
            return new Response(indexRes.body, {
              status: 200,
              headers: { "Content-Type": "text/html", ...corsHeaders }
            });
          }
        }
      }
      return secureResponse({ status: "online", message: "Ready" }, 200, corsHeaders);
    } catch (err) {
      const message2 = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Fatal Error] ${url.pathname}:`, message2);
      return secureResponse(message2, 500, corsHeaders, true);
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
