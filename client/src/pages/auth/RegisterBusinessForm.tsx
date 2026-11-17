import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/shared/Button";
import { Field, FormError, Input } from "../../components/shared/Field";
import { useAuth } from "../../contexts/AuthContext";
import { useRegisterBusiness } from "../../hooks/useAccount";
import { errorMessage } from "../../utils/errors";
import { browserTimeZone } from "../../utils/timezone";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(120),
  businessName: z.string().trim().min(2, "Enter your business name").max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => !v || /^\+?[\d\s-]{7,20}$/.test(v), "Enter a valid phone number"),
});
type Values = z.infer<typeof schema>;

/** First sign-in: creates the business with this person as owner. */
export function RegisterBusinessForm() {
  const auth = useAuth();
  const register = useRegisterBusiness();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: auth.user?.displayName ?? "", businessName: "", phone: "" },
  });

  const submit = form.handleSubmit((values) =>
    register.mutate(
      { ...values, phone: values.phone || undefined, currency: "NGN", timeZone: browserTimeZone() },
      { onSuccess: () => void auth.refresh() },
    ),
  );

  const errors = form.formState.errors;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={register.error ? errorMessage(register.error) : null} />
      <Field label="Your name" error={errors.fullName?.message}>
        {(p) => <Input {...p} autoComplete="name" {...form.register("fullName")} data-cy="register-full-name" />}
      </Field>
      <Field
        label="Business name"
        error={errors.businessName?.message}
        hint="Customers see this on receipts and your booking page."
      >
        {(p) => (
          <Input
            {...p}
            autoComplete="organization"
            {...form.register("businessName")}
            data-cy="register-business-name"
          />
        )}
      </Field>
      <Field label="Business phone (optional)" error={errors.phone?.message}>
        {(p) => <Input {...p} type="tel" autoComplete="tel" {...form.register("phone")} data-cy="register-phone" />}
      </Field>
      <Button type="submit" className="w-full" loading={register.isPending} data-cy="register-submit">
        Create my business
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => void auth.signOut()} data-cy="register-sign-out">
        Sign out ({auth.user?.email})
      </Button>
    </form>
  );
}
