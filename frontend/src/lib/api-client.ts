// Legacy compatibility facade. All requests use the shared Axios client
// and its CSRF/token-refresh interceptors from http.ts.
export {
  ApiError,
  axiosInstance,
  httpDelete,
  httpGet,
  httpPost,
  httpPut,
} from "./http";
