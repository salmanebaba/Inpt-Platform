ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_nonnegative" CHECK ("balanceCents" >= 0);
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "Ledger_nonnegative_balance" CHECK ("balanceAfterCents" >= 0);
ALTER TABLE "CouponBatch" ADD CONSTRAINT "Batch_valid_amount" CHECK ("amountCents" IN (2000, 5000, 10000));
ALTER TABLE "CouponBatch" ADD CONSTRAINT "Batch_valid_quantity" CHECK ("quantity" BETWEEN 1 AND 100);
ALTER TABLE "CouponSale" ADD CONSTRAINT "Sale_positive_amount" CHECK ("amountCents" > 0);
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_positive_price" CHECK ("priceCents" > 0);
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "Ledger_valid_source" CHECK (
  ("type" = 'COUPON_RECHARGE' AND "amountCents" > 0 AND "couponId" IS NOT NULL AND "mealId" IS NULL)
  OR ("type" = 'MEAL_DEBIT' AND "amountCents" < 0 AND "mealId" IS NOT NULL AND "couponId" IS NULL)
);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_redemption_audit" CHECK (
  ("status" = 'REDEEMED' AND "redeemedById" IS NOT NULL AND "redeemedAt" IS NOT NULL)
  OR ("status" <> 'REDEEMED' AND "redeemedById" IS NULL AND "redeemedAt" IS NULL)
);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_activation_audit" CHECK (
  "status" NOT IN ('ACTIVE', 'REDEEMED') OR ("activatedById" IS NOT NULL AND "activatedAt" IS NOT NULL)
);

CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit entries are immutable';
END;
$$;
CREATE TRIGGER immutable_ledger BEFORE UPDATE OR DELETE ON "WalletTransaction"
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER immutable_sales BEFORE UPDATE OR DELETE ON "CouponSale"
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

-- Deferred to COMMIT: a wallet update without its matching ledger entry is rejected,
-- while a transaction may insert the ledger and change the balance in either order.
CREATE FUNCTION check_wallet_ledger_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE wallet_id UUID; current_balance INTEGER; ledger_balance BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'Wallet' THEN wallet_id := NEW."id";
  ELSE wallet_id := NEW."walletId"; END IF;
  SELECT "balanceCents" INTO current_balance FROM "Wallet" WHERE "id" = wallet_id;
  SELECT COALESCE(SUM("amountCents"), 0) INTO ledger_balance FROM "WalletTransaction" WHERE "walletId" = wallet_id;
  IF current_balance IS DISTINCT FROM ledger_balance THEN
    RAISE EXCEPTION 'Wallet balance must match its immutable ledger';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER wallet_ledger_consistency AFTER INSERT OR UPDATE ON "Wallet"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_wallet_ledger_balance();
CREATE CONSTRAINT TRIGGER ledger_wallet_consistency AFTER INSERT ON "WalletTransaction"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_wallet_ledger_balance();
