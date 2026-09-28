import { onRequestOptions as __api_v1_identify_ewaste_js_onRequestOptions } from "C:\\Users\\shreyansh\\Downloads\\sih\\local host\\functions\\api\\v1\\identify-ewaste.js"
import { onRequestPost as __api_v1_identify_ewaste_js_onRequestPost } from "C:\\Users\\shreyansh\\Downloads\\sih\\local host\\functions\\api\\v1\\identify-ewaste.js"
import { onRequest as __api___path___js_onRequest } from "C:\\Users\\shreyansh\\Downloads\\sih\\local host\\functions\\api\\[[path]].js"

export const routes = [
    {
      routePath: "/api/v1/identify-ewaste",
      mountPath: "/api/v1",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_v1_identify_ewaste_js_onRequestOptions],
    },
  {
      routePath: "/api/v1/identify-ewaste",
      mountPath: "/api/v1",
      method: "POST",
      middlewares: [],
      modules: [__api_v1_identify_ewaste_js_onRequestPost],
    },
  {
      routePath: "/api/:path*",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api___path___js_onRequest],
    },
  ]