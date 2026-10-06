/// <reference types="vite/client" />
import type { Session } from './game/session';
declare global {
  interface Window {
    granule: Session;
  }
}
