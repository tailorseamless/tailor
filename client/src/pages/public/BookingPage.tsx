import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  blankRequest,
  DesignGallery,
  PublicLayout,
  PublicMessage,
  RequestFieldsForm,
  type RequestFields,
} from "../../components/public/PublicParts";
import { Button } from "../../components/shared/Button";
import { Card } from "../../components/shared/Display";
import { Field, FormError, Input } from "../../components/shared/Field";
import { FullPageSpinner } from "../../components/shared/States";
import { useBook, useBookingPage } from "../../hooks/useAccount";
import { errorMessage, statusCode } from "../../utils/errors";
import { formatDateTime } from "../../utils/formatDate";
import { localInputToIso } from "../../utils/timezone";
import { isPhone } from "../../utils/validation";

/** A business's public booking page: anyone can ask for an appointment. */
export default function BookingPage() {
  const { slug = "" } = useParams();
  const query = useBookingPage(slug);
  const book = useBook(slug);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [request, setRequest] = useState<RequestFields | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sentFor, setSentFor] = useState<string | null>(null);

  if (query.isPending) return <FullPageSpinner />;
  if (query.isError) {
    return statusCode(query.error) === 404 ? (
      <PublicMessage
        title="Booking page not found"
        message="This business isn't taking online bookings right now. Call them instead."
      />
    ) : (
      <PublicMessage title="Couldn't open this page" message={errorMessage(query.error)} />
    );
  }

  const page = query.data;
  const tz = page.business.timeZone;
  const types = page.appointmentTypes.map((t) => t.value);
  const form = request ?? { ...blankRequest(tz), type: types[0] ?? "measurement" };

  const send = () => {
    setProblem(null);
    if (fullName.trim().length < 2) return setProblem("Enter your name.");
    if (!isPhone(phone)) return setProblem("Enter a phone number we can reach you on.");
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim()))
      return setProblem("That email address doesn't look right.");
    const iso = localInputToIso(form.when, tz);
    if (new Date(iso).getTime() < Date.now()) return setProblem("Choose a time in the future.");
    book.mutate(
      {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        type: form.type,
        preferredStartsAt: iso,
        note: form.note.trim() || null,
      },
      { onSuccess: () => setSentFor(formatDateTime(iso, tz)) },
    );
  };

  return (
    <PublicLayout business={page.business}>
      {sentFor ? (
        <Card>
          <div className="flex flex-col items-center px-6 py-10 text-center" data-cy="booking-sent">
            <CheckCircle2 className="size-10 text-success-fg" aria-hidden />
            <h2 className="mt-3 font-display text-xl font-semibold text-fg">Request sent</h2>
            <p className="mt-1 max-w-sm text-sm text-fg-muted">
              {page.business.name} will confirm your appointment for around {sentFor}
              {email ? " by email" : ""}, or call you if that time doesn't work.
            </p>
          </div>
        </Card>
      ) : (
        <Card title="Book an appointment">
          <div className="space-y-4 p-4">
            <FormError message={problem ?? (book.error ? errorMessage(book.error) : null)} />
            <Field label="Your name">
              {(p) => (
                <Input
                  {...p}
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  data-cy="booking-name"
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                {(p) => (
                  <Input
                    {...p}
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    data-cy="booking-phone"
                  />
                )}
              </Field>
              <Field label="Email (optional)" hint="So we can confirm by email.">
                {(p) => (
                  <Input
                    {...p}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-cy="booking-email"
                  />
                )}
              </Field>
            </div>
            <RequestFieldsForm value={form} onChange={setRequest} types={types} />
            <Button className="w-full sm:w-auto" onClick={send} loading={book.isPending} data-cy="booking-submit">
              Request appointment
            </Button>
          </div>
        </Card>
      )}
      <DesignGallery designs={page.designs} />
    </PublicLayout>
  );
}
