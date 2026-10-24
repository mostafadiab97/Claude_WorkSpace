import type { ReqManApi } from '../shared/api'

declare global {
  interface Window {
    reqman: ReqManApi
  }
}

export {}
