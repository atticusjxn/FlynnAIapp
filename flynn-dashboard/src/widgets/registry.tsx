import type React from 'react';
import {
  InvoicingWidget, ExpensesWidget, EmailWidget, JobsPipelineWidget, CalendarWidget,
  ClientsCrmWidget, SuppliersWidget, BusinessBrainWidget, ConnectToolsWidget, UnknownWidget,
  type WidgetProps,
} from './widgets';

/**
 * Maps manifest widget `type` -> React component. Unknown types fall back to
 * UnknownWidget so a manifest produced by a newer generator never crashes an
 * older client (and keeps parity with the future iOS/Kotlin renderers).
 */
export const WIDGET_REGISTRY: Record<string, React.FC<WidgetProps>> = {
  invoicing: InvoicingWidget,
  expenses: ExpensesWidget,
  email: EmailWidget,
  jobs_pipeline: JobsPipelineWidget,
  calendar: CalendarWidget,
  clients_crm: ClientsCrmWidget,
  suppliers: SuppliersWidget,
  business_brain: BusinessBrainWidget,
  connect_tools: ConnectToolsWidget,
};

export function widgetFor(type: string): React.FC<WidgetProps> {
  return WIDGET_REGISTRY[type] || UnknownWidget;
}
