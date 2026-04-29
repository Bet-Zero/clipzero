import "react";

declare module "react" {
  interface VideoHTMLAttributes<T> {
    referrerPolicy?: HTMLAttributeReferrerPolicy;
  }
}
