'use client';

import { LeadCaptureForm } from './LeadCaptureForm';

export interface ConsultationFormProps {
  /** Optional heading override */
  heading?: string;
  /** Optional description override */
  description?: string;
  /** Optional additional CSS classes */
  className?: string;
  /** Optional callback on successful submission */
  onSuccess?: () => void;
}

/**
 * ConsultationForm — Secondary CTA form for consultation requests.
 *
 * Extends LeadCaptureForm with additional fields:
 * - Name
 * - Company
 * - Message
 *
 * Uses leadType="consultation" for lead classification.
 */
export function ConsultationForm({
  heading = 'Speak to an Advisor',
  description = 'Tell us about your ESG goals and we\'ll connect you with a specialist within 24 hours.',
  className = '',
  onSuccess,
}: ConsultationFormProps) {
  return (
    <LeadCaptureForm
      leadType="consultation"
      heading={heading}
      description={description}
      className={className}
      showName
      showCompany
      showMessage
      submitLabel="Request Consultation"
      onSuccess={onSuccess}
    />
  );
}
