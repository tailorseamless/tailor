import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  blankMeasurements,
  measurementsToSend,
  OwnMeasurementsForm,
  type OwnMeasurements,
} from "../../components/public/OwnMeasurementsForm";
import {
  blankRequest,
  PublicMessage,
  RequestFieldsForm,
  type RequestFields,
} from "../../components/public/PublicParts";
import { Photo, ShopDesigns, ShopLayout } from "../../components/public/ShopParts";
import { Button, buttonClass, IconButton } from "../../components/shared/Button";
import { Card } from "../../components/shared/Display";
import { Field, FormError, Input } from "../../components/shared/Field";
import { PhoneInput } from "../../components/shared/PhoneInput";
import { FullPageSpinner } from "../../components/shared/States";
import { useBook, useShopPage } from "../../hooks/useAccount";
import { useSharePage } from "../../hooks/useSharePage";
import type { PublicDesign } from "../../types/portal.types";
import { errorMessage, statusCode } from "../../utils/errors";
import { formatDateTime } from "../../utils/formatDate";
import { localInputToIso } from "../../utils/timezone";
import { isPhone } from "../../utils/validation";

/**
 * A business's public page, at `/<address>` (and the older `/book/<address>`): its contact details, its
 * designs with their price ranges, and — if it takes bookings — a form to ask for an appointment.
 */
export default function ShopPage() {
  const { slug = "" } = useParams();
  const query = useShopPage(slug);
  const book = useBook(slug);
  const { share } = useSharePage();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [request, setRequest] = useState<RequestFields | null>(null);
  const [own, setOwn] = useState<OwnMeasurements | null>(null);
  /** The style they tapped "Book a fitting" on. It goes with the request so the tailor sees which one. */
  const [style, setStyle] = useState<PublicDesign | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sentFor, setSentFor] = useState<string | null>(null);
  /** How many measurements went with the request that was just sent. */
  const [sentMeasurements, setSentMeasurements] = useState(0);

  const shopName = query.data?.business.name;
  useEffect(() => {
    if (!shopName) return;
    const previous = document.title;
    document.title = `${shopName} · Designs and prices`;
    return () => {
      document.title = previous;
    };
  }, [shopName]);

  if (query.isPending) return <FullPageSpinner />;
  if (query.isError) {
    // An address that isn't even shaped like one (`/x`) is refused as invalid input: to a visitor it's the same "no page here".
    const missing = [400, 404, 422].includes(statusCode(query.error) ?? 0);
    return missing ? (
      <PublicMessage
        title="Page not found"
        message="There's no page at this address. Check the link, or ask the business to send it again."
        action={
          <Link to="/" className={buttonClass("secondary")}>
            Go to Tailor Seamless
          </Link>
        }
      />
    ) : (
      <PublicMessage title="Couldn't open this page" message={errorMessage(query.error)} />
    );
  }

  const page = query.data;
  const tz = page.business.timeZone;
  const types = page.appointmentTypes.map((t) => t.value);
  const form = request ?? { ...blankRequest(tz), type: types[0] ?? "measurement" };
  const mine = own ?? blankMeasurements(page.business.measurementUnit);

  const bookStyle = (design: PublicDesign) => {
    setStyle(design);
    setRequest({ ...form, note: `I'd like this style: ${design.name}`.slice(0, 500) });
    // Let the viewer close first, so the page isn't still locked from scrolling.
    window.setTimeout(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("book")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }, 80);
  };

  const send = () => {
    setProblem(null);
    if (fullName.trim().length < 2) return setProblem("Enter your name.");
    if (!isPhone(phone)) return setProblem("Enter a phone number we can reach you on.");
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim()))
      return setProblem("That email address doesn't look right.");
    const iso = localInputToIso(form.when, tz);
    if (new Date(iso).getTime() < Date.now()) return setProblem("Choose a time in the future.");
    const measured = measurementsToSend(mine);
    if ("problem" in measured) {
      setOwn({ ...mine, open: true }); // so the row in question is on screen
      return setProblem(measured.problem);
    }
    const withMeasurements = measured.values.length > 0;
    book.mutate(
      {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        type: form.type,
        preferredStartsAt: iso,
        note: form.note.trim() || null,
        designId: style?.id ?? null,
        measurements: withMeasurements ? measured.values : undefined,
        measurementUnit: withMeasurements ? mine.unit : undefined,
      },
      {
        onSuccess: () => {
          setSentFor(formatDateTime(iso, tz));
          setSentMeasurements(measured.values.length);
        },
      },
    );
  };

  const removeStyle = () => {
    if (style && form.note === `I'd like this style: ${style.name}`.slice(0, 500)) setRequest({ ...form, note: "" });
    setStyle(null);
  };

  /** Back to an empty form for a second request: who they are stays filled in, what they ask for starts fresh. */
  const another = () => {
    book.reset();
    setSentFor(null);
    setSentMeasurements(0);
    setRequest(null);
    setOwn(null);
    setStyle(null);
    setProblem(null);
  };

  return (
    <ShopLayout business={page.business} onShare={() => void share(window.location.href, page.business.name)}>
      <ShopDesigns designs={page.designs} business={page.business} bookingOpen={page.bookingOpen} onBook={bookStyle} />
      {page.bookingOpen && (
        <section id="book" className="mx-auto max-w-3xl scroll-mt-4">
          {sentFor ? (
            <Card>
              <div className="flex flex-col items-center px-6 py-10 text-center" data-cy="booking-sent">
                <CheckCircle2 className="size-10 text-success-fg" aria-hidden />
                <h2 className="mt-3 font-display text-xl font-semibold text-fg">Request sent</h2>
                <p className="mt-1 max-w-sm text-sm text-fg-muted">
                  {page.business.name} will confirm your appointment for around {sentFor}
                  {email ? " by email" : ""}, or call you if that time doesn't work.
                </p>
                {sentMeasurements > 0 && (
                  <p className="mt-2 max-w-sm text-sm text-fg-muted" data-cy="booking-sent-measurements">
                    Your {sentMeasurements} measurement{sentMeasurements === 1 ? "" : "s"} went with it. They'll check
                    them with you.
                  </p>
                )}
                <Button variant="secondary" className="mt-5" onClick={another} data-cy="booking-another">
                  Make another request
                </Button>
              </div>
            </Card>
          ) : (
            <Card title="Book an appointment">
              <div className="space-y-4 p-4">
                <FormError message={problem ?? (book.error ? errorMessage(book.error) : null)} />
                {style && (
                  <div
                    className="flex items-center gap-3 rounded-lg border border-line bg-subtle p-2"
                    data-cy="booking-style"
                  >
                    {style.images[0] && (
                      <Photo url={style.images[0].url} alt="" width={160} className="size-14 rounded-md object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-fg-subtle">About this style</p>
                      <p className="truncate text-sm font-medium text-fg">{style.name}</p>
                    </div>
                    <IconButton label="Remove this style" onClick={removeStyle} data-cy="booking-style-remove">
                      <X className="size-4" aria-hidden />
                    </IconButton>
                  </div>
                )}
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
                    {(p) => <PhoneInput {...p} value={phone} onChange={setPhone} data-cy="booking-phone" />}
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
                <OwnMeasurementsForm value={mine} onChange={setOwn} />
                <Button className="w-full sm:w-auto" onClick={send} loading={book.isPending} data-cy="booking-submit">
                  Request appointment
                </Button>
              </div>
            </Card>
          )}
        </section>
      )}
    </ShopLayout>
  );
}
