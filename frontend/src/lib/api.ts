import axios from "axios";
import { queryClient } from "./queryClient";

const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,  // send session cookie on every request
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor: redirect to /login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth store
      queryClient.clear();
      window.location.replace("/login");
    }
    return Promise.reject(error);
  }
);

export default api;
