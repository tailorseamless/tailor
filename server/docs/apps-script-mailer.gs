/**
 * Tailor Seamless mail relay — a Google Apps Script web app (EMAIL_PROVIDER=apps_script).
 *
 * Setup (once, in the Google account that should send the mail):
 *   1. script.google.com → New project → paste this file.
 *   2. Project Settings → Script properties → add MAIL_TOKEN = a long random string.
 *      Put the same value in the API's EMAIL_APPS_SCRIPT_TOKEN.
 *   3. Deploy → New deployment → type "Web app" →
 *        Execute as: Me      Who has access: Anyone
 *      Authorise the MailApp permission when asked.
 *   4. Copy the deployment URL that ends in /exec into EMAIL_APPS_SCRIPT_URL.
 *      (The /dev URL only works for you while signed in — the API gets a sign-in page.)
 *   5. After editing this file: Deploy → Manage deployments → edit → New version.
 *
 * Mail is sent FROM this Google account; the API sets only the display name.
 * A personal Gmail account can send about 100 recipients a day (more on Workspace).
 * The URL is a credential: keep it out of git.
 *
 * The API always reads the JSON reply: { status: "ok" } or { status: "error", message }.
 */
function doPost(e) {
  try {
    var request = JSON.parse(e.postData.contents);
    var expected = PropertiesService.getScriptProperties().getProperty("MAIL_TOKEN");
    if (expected && request.token !== expected) return reply({ status: "error", message: "Not authorised." });
    if (!request.to || !request.subject) return reply({ status: "error", message: "to and subject are required." });

    var options = {
      htmlBody: request.htmlBody || "",
      name: request.name || "Tailor Seamless",
    };
    if (request.replyTo) options.replyTo = request.replyTo;
    if (request.attachments && request.attachments.length) {
      options.attachments = request.attachments.map(function (file) {
        return Utilities.newBlob(Utilities.base64Decode(file.content), file.mimeType, file.fileName);
      });
    }

    MailApp.sendEmail(request.to, request.subject, request.body || "", options);
    return reply({ status: "ok", remainingQuota: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return reply({ status: "error", message: String(err && err.message ? err.message : err) });
  }
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
