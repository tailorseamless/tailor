/** The words Snap a record uses in more than one place, so they say the same thing everywhere. */
export const captureCopy = {
  reading: "Reading your records… this can take up to a minute for a full page.",
  /** Shown before reading: what is left, and what happens. */
  notice: (tokens: number) =>
    `You have ${tokens.toLocaleString()} tokens. An AI service reads your files; nothing is saved until you press Save.`,
  /** Shown above the draft. */
  spent: (used: number, left: number) =>
    `This used ${used.toLocaleString()} tokens. You have ${left.toLocaleString()} left.`,
};
