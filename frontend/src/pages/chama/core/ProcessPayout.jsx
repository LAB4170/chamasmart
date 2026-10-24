import { Navigate, useParams } from "react-router-dom";

/** Payouts are recorded from the merry-go-round roster on the Payouts page. */
export default function ProcessPayout() {
  const { id } = useParams();
  return <Navigate to={`/chamas/${id}/payouts`} replace />;
}
