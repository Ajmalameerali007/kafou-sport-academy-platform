"use client";
import { administratorVerified } from "@/lib/platform/contracts";
import { useLocale } from "@/components/kafou/locale";
import { ProductForm, val, type ProductProps } from "./product-shared";
import { productCommand } from "@/lib/platform/product";
import { useState } from "react";
const permissions = [
  "accounts.expenses",
  "accounts.payroll",
  "accounts.timekeeping",
  "finance.view",
  "finance.packages",
  "finance.memberships",
  "finance.invoices",
  "finance.payment",
  "finance.discount",
  "finance.credit",
  "finance.refund",
  "finance.writeoff",
  "finance.freeze",
  "finance.compensation",
  "finance.compensation_payment",
  "development.configure",
  "development.review",
  "development.publish",
  "development.certify",
  "engagement.configure",
  "engagement.review",
  "engagement.grant",
  "attendance.finalize",
  "attendance.photo",
  "events.manage",
  "development.safety",
  "attendance.correct",
  "operations.transfer",
  "communications.broadcast",
];
export function ProductAccess({ account, data, refresh }: ProductProps) {
  const { t } = useLocale();
  const [notice, setNotice] = useState("");
  if (!account.roles.includes("super_admin") || !administratorVerified(account))
    return null;
  return (
    <details className="product-panel">
      <summary>{t("Financial and operational permissions")}</summary>
      <p>
        {t(
          "These grants are separate from workspace roles and branch access. Revocation is checked on every request.",
        )}
      </p>
      <p>{t("Accounts grants require a blank branch and apply centrally.")}</p>
      <ProductForm
        title="Grant capability"
        action="permission.grant"
        fields={[
          {
            name: "user_id",
            label: "Staff account",
            required: true,
            options: (data.staff_directory || []).map((r) => ({
              value: val(r, "id"),
              label: val(r, "name"),
            })),
          },
          {
            name: "permission",
            label: "Permission",
            required: true,
            options: permissions.map((p) => ({
              value: p,
              label:
                p === "finance.invoices" ? t("Create standalone invoices") : t(p),
            })),
          },
          {
            name: "branch_id",
            label: "Branch (blank means all permitted branches)",
            options: (data.branches || []).map((r) => ({
              value: val(r, "id"),
              label: val(r, "name"),
            })),
          },
        ]}
        onSaved={refresh}
      />
      {notice && <p role="status">{notice}</p>}
      {(data.product_permissions || []).map((p) => (
        <div className="product-record" key={val(p, "id")}>
          <span>
            {val(
              (data.staff_directory || []).find((r) => r.id === p.user_id),
              "name",
            )}
            <small>
              {val(p, "permission")} ·{" "}
              {val(
                (data.branches || []).find((b) => b.id === p.branch_id),
                "name",
              ) || t("All permitted branches")}
            </small>
          </span>
          <button
            onClick={async () => {
              const r = await productCommand("permission.revoke", { id: p.id });
              setNotice(r.ok ? t("Saved") : t(r.message));
              if (r.ok) refresh();
            }}
          >
            {t("Revoke")}
          </button>
        </div>
      ))}
    </details>
  );
}
