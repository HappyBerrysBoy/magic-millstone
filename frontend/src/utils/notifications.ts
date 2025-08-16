import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const successToast = (msg: string) => {
  toast.success(msg);
};

export const errorToast = (msg: string) => {
  toast.error(msg);
};

export const errorRetry = () => {
  toast.error("Woops! Something went wrong. Please, try again later.");
};
