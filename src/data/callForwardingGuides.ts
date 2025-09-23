export interface CarrierForwardingCode {
  type: 'busy' | 'noAnswer' | 'unreachable' | 'all';
  label: string;
  code: string;
  description?: string;
}

export interface CallForwardingGuide {
  id: string;
  name: string;
  region: string;
  codes: CarrierForwardingCode[];
  supportUrl?: string;
  notes?: string;
}

// Codes follow common GSM/UMTS star codes. Users should confirm with their carrier.
export const callForwardingGuides: CallForwardingGuide[] = [
  {
    id: 'au-telstra',
    name: 'Telstra',
    region: 'Australia',
    codes: [
      {
        type: 'noAnswer',
        label: 'Forward when unanswered',
        code: '*61*{forwarding}#',
        description: 'Default ring time is 20 seconds; you can change it after the number.'
      },
      {
        type: 'busy',
        label: 'Forward when busy',
        code: '*67*{forwarding}#'
      },
      {
        type: 'unreachable',
        label: 'Forward when unreachable',
        code: '*62*{forwarding}#'
      },
      {
        type: 'all',
        label: 'Turn off forwarding',
        code: '##002#'
      }
    ],
    supportUrl: 'https://www.telstra.com.au/support/mobiles-devices/call-forwarding',
    notes: 'Wait for the confirmation tone before ending the call to ensure forwarding is activated.'
  },
  {
    id: 'au-optus',
    name: 'Optus',
    region: 'Australia',
    codes: [
      {
        type: 'noAnswer',
        label: 'Forward when unanswered',
        code: '*61*{forwarding}#',
        description: 'You can follow the number with **20# to set a 20 second ring duration.'
      },
      {
        type: 'busy',
        label: 'Forward when busy',
        code: '*67*{forwarding}#'
      },
      {
        type: 'unreachable',
        label: 'Forward when unreachable',
        code: '*62*{forwarding}#'
      },
      {
        type: 'all',
        label: 'Turn off forwarding',
        code: '##002#'
      }
    ],
    supportUrl: 'https://www.optus.com.au/customer-extras/faq/call-forwarding',
    notes: 'If the codes fail, the My Optus app can enable diversions from the device settings.'
  },
  {
    id: 'au-vodafone',
    name: 'Vodafone Australia',
    region: 'Australia',
    codes: [
      {
        type: 'noAnswer',
        label: 'Forward when unanswered',
        code: '*61*{forwarding}#',
        description: 'Add **30# after the number to extend ringing to 30 seconds if required.'
      },
      {
        type: 'busy',
        label: 'Forward when busy',
        code: '*67*{forwarding}#'
      },
      {
        type: 'unreachable',
        label: 'Forward when unreachable',
        code: '*62*{forwarding}#'
      },
      {
        type: 'all',
        label: 'Turn off forwarding',
        code: '##002#'
      }
    ],
    supportUrl: 'https://support.vodafone.com.au/articles/FAQ/Call-forwarding',
    notes: 'Vodafone sometimes refers to diversions as “call forwarding” in My Vodafone → Services.'
  },
  {
    id: 'us-att',
    name: 'AT&T',
    region: 'United States',
    codes: [
      {
        type: 'noAnswer',
        label: 'Forward when unanswered',
        code: '*61*{forwarding}#',
        description: 'Activates after 20 seconds of ringing by default.'
      },
      {
        type: 'busy',
        label: 'Forward when busy',
        code: '*67*{forwarding}#'
      },
      {
        type: 'unreachable',
        label: 'Forward when unreachable',
        code: '*62*{forwarding}#'
      },
      {
        type: 'all',
        label: 'Turn off forwarding',
        code: '#004#',
        description: 'Use this if you need to reset forwarding completely.'
      }
    ],
    supportUrl: 'https://www.att.com/support/article/wireless/KM1061254/',
    notes: 'AT&T sometimes requires HD Voice enabled for conditional forwarding.'
  },
  {
    id: 'us-verizon',
    name: 'Verizon',
    region: 'United States',
    codes: [
      {
        type: 'noAnswer',
        label: 'Forward when unanswered',
        code: '*71{forwarding}',
        description: 'Press call after dialing. Default ring time is 30 seconds.'
      },
      {
        type: 'busy',
        label: 'Forward when busy',
        code: '*90{forwarding}'
      },
      {
        type: 'unreachable',
        label: 'Forward when unreachable',
        code: '*92{forwarding}'
      },
      {
        type: 'all',
        label: 'Turn off forwarding',
        code: '*73'
      }
    ],
    supportUrl: 'https://www.verizon.com/support/knowledge-base-200867/',
    notes: 'Some business plans require you to enable forwarding from My Verizon first.'
  },
  {
    id: 'us-tmobile',
    name: 'T-Mobile',
    region: 'United States',
    codes: [
      {
        type: 'noAnswer',
        label: 'Forward when unanswered',
        code: '*61*{forwarding}#'
      },
      {
        type: 'busy',
        label: 'Forward when busy',
        code: '*67*{forwarding}#'
      },
      {
        type: 'unreachable',
        label: 'Forward when unreachable',
        code: '*62*{forwarding}#'
      },
      {
        type: 'all',
        label: 'Turn off forwarding',
        code: '##004#'
      }
    ],
    supportUrl: 'https://www.t-mobile.com/support/devices/learn-about-call-forwarding',
    notes: 'If the code fails, use the T-Mobile app to manage forwarding.'
  },
  {
    id: 'uk-o2',
    name: 'O2',
    region: 'United Kingdom',
    codes: [
      {
        type: 'noAnswer',
        label: 'Forward when unanswered',
        code: "**61*{forwarding}*11#",
        description: 'Default delay is 15 seconds; replace 11 with 20 or 30 to change.'
      },
      {
        type: 'busy',
        label: 'Forward when busy',
        code: '**67*{forwarding}#'
      },
      {
        type: 'unreachable',
        label: 'Forward when unreachable',
        code: '**62*{forwarding}#'
      },
      {
        type: 'all',
        label: 'Turn off forwarding',
        code: '##61#'
      }
    ],
    supportUrl: 'https://www.o2.co.uk/help/phones-devices-and-sims/diverts-and-call-forwarding',
    notes: 'Postpay and business accounts can also set this from the My O2 portal.'
  }
];
