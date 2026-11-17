import { ButtonLink } from "../components/shared/Button";
import { EmptyState } from "../components/shared/States";

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Nothing here"
      message="This page doesn't exist."
      action={
        <ButtonLink to="/" data-cy="not-found-home">
          Go home
        </ButtonLink>
      }
    />
  );
}
