import { DISTRIBUTORS } from "@shared/distributors";
import type { DistributorListing, Product } from "../../../../lib/types";
import { DistributorHistoryModal } from "../DistributorHistoryModal";
import { EditProductModal } from "./EditProductModal";
import { SetAlertModal } from "./SetAlertModal";
import { PerListingAlertModal } from "./PerListingAlertModal";
import { ReminderDatePickerModal } from "./ReminderDatePickerModal";
import { InlineAlertReminderSections } from "./InlineAlertReminderSections";
import type { useProductAlerts } from "../../hooks/use-product-alerts";
import type { useProductReminders } from "../../hooks/use-product-reminders";
import type { useProductEdit } from "../../hooks/use-product-edit";

export function ProductDetailModals({
  product,
  visibleListings,
  historyFor,
  setHistoryFor,
  displayCurrency,
  edit,
  alert,
  reminder,
}: {
  product: Product;
  visibleListings: DistributorListing[];
  historyFor: DistributorListing | null;
  setHistoryFor: (listing: DistributorListing | null) => void;
  displayCurrency: string;
  edit: ReturnType<typeof useProductEdit>;
  alert: ReturnType<typeof useProductAlerts>;
  reminder: ReturnType<typeof useProductReminders>;
}) {
  return (
    <>
      <EditProductModal
        open={edit.editOpen}
        onClose={edit.closeEdit}
        name={edit.editName}
        onNameChange={edit.setEditName}
        model={edit.editModel}
        onModelChange={edit.setEditModel}
        brand={edit.editBrand}
        onBrandChange={edit.setEditBrand}
        category={edit.editCategory}
        onCategoryChange={edit.setEditCategory}
        description={edit.editDescription}
        onDescriptionChange={edit.setEditDescription}
        error={edit.editError}
        originalName={product.name ?? ""}
        originalModel={product.modelNumber ?? ""}
        originalBrand={product.brand ?? ""}
        originalCategory={product.category ?? ""}
        originalDescription={product.description ?? ""}
        onSave={edit.handleSaveEdit}
      />

      <SetAlertModal
        open={alert.alertOpen}
        onClose={alert.closeSetAlert}
        productName={product.name}
        alertSaved={alert.alertSaved}
        alertError={alert.alertError}
        direction={alert.alertDirection}
        onDirectionChange={alert.setAlertDirection}
        distributorId={alert.alertDistributorId}
        onDistributorChange={alert.setAlertDistributorId}
        listings={visibleListings}
        suggestions={alert.alertSuggestions}
        price={alert.alertPrice}
        onPriceChange={alert.setAlertPrice}
        currency={alert.alertCurrency}
        onCurrencyChange={alert.setAlertCurrency}
        saving={alert.creatingAlert}
        onSave={alert.handleSaveAlert}
      />

      <PerListingAlertModal
        open={!!alert.perListingAlertId}
        onClose={alert.closePerListingAlert}
        productName={product.name}
        distributorId={alert.perListingAlertId}
        direction={alert.perListingAlertDirection}
        onDirectionChange={alert.setPerListingAlertDirection}
        suggestions={alert.perListingAlertSuggestions}
        price={alert.perListingAlertPrice}
        onPriceChange={alert.setPerListingAlertPrice}
        currency={alert.perListingAlertCurrency}
        onCurrencyChange={alert.setPerListingAlertCurrency}
        saving={alert.creatingAlert}
        onSave={alert.handlePerListingAlert}
      />

      <ReminderDatePickerModal
        open={reminder.reminderOpen}
        onClose={reminder.closeReminder}
        productName={product.name}
        listings={visibleListings}
        distributorId={reminder.reminderDistributorId}
        onDistributorChange={reminder.setReminderDistributorId}
        dateInput={reminder.reminderDateInput}
        onDateChange={reminder.setReminderDateInput}
        error={reminder.reminderError}
        saving={reminder.savingReminder}
        onSave={reminder.handleSetReminder}
      />

      <DistributorHistoryModal
        open={historyFor !== null}
        onClose={() => setHistoryFor(null)}
        productId={product.id}
        productName={product.name}
        listing={historyFor}
        distributorName={DISTRIBUTORS.find((d) => d.id === historyFor?.distributorId)?.name ?? historyFor?.distributorId ?? ""}
        displayCurrency={displayCurrency}
      />

      <InlineAlertReminderSections
        listings={visibleListings}
        alertDirection={alert.inlineAlertDirection}
        onAlertDirectionChange={alert.setInlineAlertDirection}
        alertDistributorId={alert.inlineAlertDistributorId}
        onAlertDistributorChange={alert.setInlineAlertDistributorId}
        alertPrice={alert.inlineAlertPrice}
        onAlertPriceChange={alert.setInlineAlertPrice}
        alertCurrency={alert.inlineAlertCurrency}
        onAlertCurrencyChange={alert.setInlineAlertCurrency}
        onAddAlert={alert.handleInlineAlert}
        reminderDistributorId={reminder.inlineReminderDistributorId}
        onReminderDistributorChange={reminder.setInlineReminderDistributorId}
        reminderDate={reminder.inlineReminderDate}
        onReminderDateChange={reminder.setInlineReminderDate}
        reminderError={reminder.inlineReminderError}
        onAddReminder={reminder.handleInlineReminder}
      />
    </>
  );
}
