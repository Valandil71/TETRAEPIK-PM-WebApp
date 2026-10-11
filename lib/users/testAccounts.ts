/** Test accounts that are not offered for project assignment in production. */
const TEST_ACCOUNT_NAMES = ["Francisco Rodrigues", "Xiconi das Coves"];

const normalize = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const testAccountNames = new Set(TEST_ACCOUNT_NAMES.map(normalize));

/**
 * Whether a user should be left out of the assignment pickers. Only `next dev` (localhost)
 * shows the test accounts, so they can be assigned to try things out; every build
 * (Vercel preview/production, `next start`) hides them. Next inlines NODE_ENV at build time.
 */
export function isHiddenTestAccount(
  name: string,
  showTestAccounts = process.env.NODE_ENV === "development"
): boolean {
  return !showTestAccounts && testAccountNames.has(normalize(name));
}
