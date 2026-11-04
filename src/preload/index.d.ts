import type { ReqochetApi } from '../shared/api'

declare global {
  interface Window {
    reqochet: ReqochetApi
  }
}

export {}
