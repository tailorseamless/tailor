const ACCOUNT_NUMBER = /^[A-Za-z0-9]{4,34}$/;

/** What is wrong with the bank details, or null. All three, or none: the server holds the same rules. */
export function bankAccountProblem(account: {
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
}): string | null {
  const filled = Object.values(account).filter(Boolean).length;
  if (filled > 0 && filled < 3) {
    return "Add the bank name, account number and account name together, or leave all three empty.";
  }
  if (account.accountNumber && !ACCOUNT_NUMBER.test(account.accountNumber.replace(/[\s-]/g, ""))) {
    return "The account number can use letters and digits only, 4 to 34 characters.";
  }
  return null;
}
