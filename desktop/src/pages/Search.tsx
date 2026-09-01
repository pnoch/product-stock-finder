import { useNavigate } from "react-router";
import { SearchModal } from "../components/SearchModal";

export function Search() {
  const navigate = useNavigate();
  const handleClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };
  return <SearchModal open={true} onClose={handleClose} />;
}