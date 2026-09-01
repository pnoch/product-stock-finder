import { useNavigate } from "react-router";
import { SearchModal } from "../components/SearchModal";

export function Search() {
  const navigate = useNavigate();
  return <SearchModal open={true} onClose={() => navigate(-1)} />;
}