import { VeraHomebridgePlatform } from './platform.js';
import { PLATFORM_NAME } from './settings.js';
/** Homebridge entry point: register the dynamic platform. */
export default (api) => {
    api.registerPlatform(PLATFORM_NAME, VeraHomebridgePlatform);
};
//# sourceMappingURL=index.js.map