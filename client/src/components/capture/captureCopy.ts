/** The words Snap a record uses in more than one place, so they say the same thing everywhere. */
export const captureCopy = {
  reading: "Reading your records… this can take up to a minute for a full page.",
  /** What leaves the platform, and what doesn't. */
  disclosure: (provider: string) =>
    `The photos are sent to ${provider} to be read, with your measurement template names, unit and currency. Nothing else about your business or customers is sent. Tailor Seamless doesn't keep the photos, and nothing is saved until you check it and press Save.`,
};
