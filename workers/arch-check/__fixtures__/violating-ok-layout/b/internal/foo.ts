// Private to module "b". Reaching into this file from any other module
// is exactly the boundary violation arch-check is designed to catch.
export const bSecret = "should-not-be-importable";
