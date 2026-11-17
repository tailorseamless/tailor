import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useCreateCustomer, useUpdateCustomer } from "../../hooks/useCustomers";
import type { Customer, CustomerGender } from "../../types/customer.types";
import { errorMessage, fieldErrors, statusCode } from "../../utils/errors";
import { emailOptional, orNull, phoneRequired } from "../../utils/validation";
import { Button } from "../shared/Button";
import { Field, FormError, Input, Select, Textarea } from "../shared/Field";
import { Modal } from "../shared/Modal";
import { PhoneInput } from "../shared/PhoneInput";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter the customer's name").max(150),
  phone: phoneRequired,
  email: emailOptional,
  address: z.string().trim().max(300),
  gender: z.enum(["", "female", "male", "other"]),
  notes: z.string().trim().max(2000),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  customer?: Customer;
  onSaved?: (customer: Customer) => void;
}

/** Add or edit a customer. A phone number someone else has asks before saving a second record. */
export function CustomerForm({ open, onClose, customer, onSaved }: Props) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer(customer?.id ?? "");
  const mutation = customer ? update : create;
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      fullName: customer?.fullName ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      address: customer?.address ?? "",
      gender: customer?.gender ?? "",
      notes: customer?.notes ?? "",
    },
  });

  const close = () => {
    setDuplicate(null);
    mutation.reset();
    form.reset();
    onClose();
  };

  const save = (values: Values, confirmDuplicate = false) => {
    const input = {
      fullName: values.fullName,
      phone: values.phone,
      email: orNull(values.email),
      address: orNull(values.address),
      gender: (values.gender || null) as CustomerGender | null,
      notes: orNull(values.notes),
      ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
    };
    mutation.mutate(input, {
      onSuccess: (saved) => {
        onSaved?.(saved);
        close();
      },
      onError: (err) => {
        if (statusCode(err) === 409) {
          const detail = fieldErrors(err)[0];
          if (detail?.customerId)
            setDuplicate({ id: String(detail.customerId), name: String(detail.customerName ?? "another customer") });
        }
      },
    });
  };

  const submit = form.handleSubmit((values) => save(values));
  const errors = form.formState.errors;
  const showError = mutation.error && !duplicate ? errorMessage(mutation.error) : null;

  return (
    <Modal
      open={open}
      onClose={close}
      title={customer ? "Edit customer" : "New customer"}
      footer={
        <>
          <Button variant="secondary" onClick={close} data-cy="customer-cancel">
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={mutation.isPending} data-cy="customer-save">
            {customer ? "Save" : "Add customer"}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={showError} />
        {duplicate && (
          <div role="alert" className="rounded-lg bg-warning-bg p-3 text-sm text-warning-fg">
            <p>
              This phone number belongs to <strong>{duplicate.name}</strong>.{" "}
              <Link to={`/customers/${duplicate.id}`} className="underline" onClick={close}>
                Open their record
              </Link>{" "}
              or save anyway.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => save(form.getValues(), true)}
              loading={mutation.isPending}
              data-cy="customer-save-duplicate"
            >
              Save as a separate customer
            </Button>
          </div>
        )}
        <Field label="Full name" error={errors.fullName?.message}>
          {(p) => <Input {...p} autoComplete="off" {...form.register("fullName")} data-cy="customer-name" />}
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          {(p) => (
            <Controller
              control={form.control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  {...p}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  data-cy="customer-phone"
                />
              )}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email (optional)" error={errors.email?.message}>
            {(p) => <Input {...p} type="email" {...form.register("email")} data-cy="customer-email" />}
          </Field>
          <Field label="Gender (optional)">
            {(p) => (
              <Select {...p} {...form.register("gender")} data-cy="customer-gender">
                <option value="">Not set</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label="Address (optional)" error={errors.address?.message}>
          {(p) => <Input {...p} {...form.register("address")} data-cy="customer-address" />}
        </Field>
        <Field
          label="Notes (optional)"
          error={errors.notes?.message}
          hint="Style preferences, fabric notes, anything useful."
        >
          {(p) => <Textarea {...p} {...form.register("notes")} data-cy="customer-notes" />}
        </Field>
      </form>
    </Modal>
  );
}
