/**
 * lib/db/marketing.ts — Marketing-Domain-Barrel
 * Re-exportiert alle Marketing-Funktionen aus lib/db.ts.
 */
export {
  getMarketingKampagnen,
  upsertMarketingKampagne,
  deleteMarketingKampagne,
  getMarketingLeads,
  upsertMarketingLead,
  deleteMarketingLead,
  getMarketingNewsletter,
  upsertMarketingNewsletter,
  deleteMarketingNewsletter,
  getMarketingSeoKeywords,
  upsertMarketingSeoKeyword,
  deleteMarketingSeoKeyword,
  getMarketingContentIdeas,
  upsertMarketingContentIdea,
  deleteMarketingContentIdea,
  getMarketingPostingPlans,
  upsertMarketingPostingPlan,
  deleteMarketingPostingPlan,
  getMarketingAutomationRules,
  upsertMarketingAutomationRule,
  deleteMarketingAutomationRule,
  getMarketingIntegrationItems,
  upsertMarketingIntegrationItem,
  deleteMarketingIntegrationItem,
} from '../db'
