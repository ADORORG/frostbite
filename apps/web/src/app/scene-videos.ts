// Where the app serves the rendered scene videos from: the folder `pnpm scenes:render` fills under `public/`. A browser that cannot draw
// a scene plays these instead; where they have not been rendered it shows nothing, and the page works the same.
export const sceneVideoBase = "/scenes";
