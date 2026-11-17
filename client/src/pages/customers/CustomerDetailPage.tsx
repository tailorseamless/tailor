import { MessageCircle, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CustomerForm } from "../../components/customers/CustomerForm";
import { MeasurementsCard } from "../../components/customers/MeasurementsCard";
import { PortalLinkCard } from "../../components/customers/PortalLinkCard";
import { OrderRow } from "../../components/orders/OrderRow";
import { Button, ButtonLink } from "../../components/shared/Button";
import { Card, Detail, PageHeader } from "../../components/shared/Display";
import { ConfirmDialog } from "../../components/shared/Modal";
import { EmptyState, QueryState } from "../../components/shared/States";
import { useCustomer, useDeleteCustomer } from "../../hooks/useCustomers";
import { useOrders } from "../../hooks/useOrders";
import { useWorkspace } from "../../hooks/useWorkspace";
import { formatDate } from "../../utils/formatDate";
import { whatsappLink } from "../../utils/validation";

export default function CustomerDetailPage() {
  const { id = "" } = useParams();
  const { can, timeZone } = useWorkspace();
  const navigate = useNavigate();
  const query = useCustomer(id);
  const orders = useOrders({ customerId: id, limit: 20 }, can("order.read"));
  const remove = useDeleteCustomer();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <QueryState query={query} loadingLabel="Loading customer">
      {(c) => (
        <>
          <PageHeader
            back={{ to: "/customers", label: "Customers" }}
            title={c.fullName}
            subtitle={`Customer since ${formatDate(c.createdAt, timeZone)}`}
            actions={
              <>
                <a
                  href={`tel:${c.phone}`}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-fg hover:bg-subtle"
                  data-cy="customer-call"
                >
                  <Phone className="size-4" aria-hidden /> Call
                </a>
                <a
                  href={whatsappLink(`Hi ${c.fullName.split(" ")[0]}, `, c.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-fg hover:bg-subtle"
                  data-cy="customer-whatsapp"
                >
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp
                </a>
                {can("order.create") && (
                  <ButtonLink
                    to={`/orders/new?customer=${c.id}`}
                    icon={<Plus className="size-4" aria-hidden />}
                    data-cy="customer-new-order"
                  >
                    New order
                  </ButtonLink>
                )}
              </>
            }
          />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <MeasurementsCard customerId={c.id} />
              {can("order.read") && (
                <Card title="Orders">
                  <QueryState query={orders}>
                    {({ data }) =>
                      data.length ? (
                        <ul className="divide-y divide-line">
                          {data.map((o) => (
                            <OrderRow key={o.id} order={o} />
                          ))}
                        </ul>
                      ) : (
                        <EmptyState title="No orders yet" />
                      )
                    }
                  </QueryState>
                </Card>
              )}
            </div>
            <div className="space-y-5">
              <Card
                title="Details"
                action={
                  can("customer.update") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Pencil className="size-4" aria-hidden />}
                      onClick={() => setEditing(true)}
                      data-cy="customer-edit"
                    >
                      Edit
                    </Button>
                  )
                }
              >
                <dl className="space-y-3 px-4 py-3">
                  <Detail label="Phone">{c.phone}</Detail>
                  <Detail label="Email">{c.email}</Detail>
                  <Detail label="Address">{c.address}</Detail>
                  <Detail label="Notes">{c.notes && <span className="whitespace-pre-line">{c.notes}</span>}</Detail>
                </dl>
              </Card>
              <PortalLinkCard customer={c} />
              {can("customer.delete") && (
                <Button
                  variant="ghost"
                  className="w-full text-danger-fg"
                  icon={<Trash2 className="size-4" aria-hidden />}
                  onClick={() => setDeleting(true)}
                  data-cy="customer-delete"
                >
                  Remove customer
                </Button>
              )}
            </div>
          </div>
          <CustomerForm open={editing} onClose={() => setEditing(false)} customer={c} />
          <ConfirmDialog
            open={deleting}
            onClose={() => setDeleting(false)}
            onConfirm={() => remove.mutate(c.id, { onSuccess: () => navigate("/customers", { replace: true }) })}
            title={`Remove ${c.fullName}?`}
            message="They disappear from your customer list. Their past orders and payments stay in your records."
            confirmLabel="Remove"
            danger
            loading={remove.isPending}
          />
        </>
      )}
    </QueryState>
  );
}
