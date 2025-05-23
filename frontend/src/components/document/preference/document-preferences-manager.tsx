import i18n from "i18next";
import { Loader2, Save } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import TagInput from "@/components/common/tag-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { documentService } from "@/services/document.service";
import { useAppDispatch, useAppSelector } from "@/store/hook";
import { fetchMasterData, selectMasterData } from "@/store/slices/master-data-slice";
import { DocumentPreferences, InteractionStats, PreferenceCategory } from "@/types/document-preference";
import { getDescriptionType } from "@/lib/utils";

const SUPPORTED_LANGUAGES = [
  { code: "en", display: "English" },
  { code: "vi", display: "Tiếng Việt" },
];

export default function DocumentPreferencesManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const { majors, courseCodes, levels, categories, loading: masterDataLoading } = useAppSelector(selectMasterData);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<DocumentPreferences | null>(null);
  const [weights, setWeights] = useState<PreferenceCategory[]>([]);
  const [stats, setStats] = useState<InteractionStats | null>(null);
  const [recommendedTags, setRecommendedTags] = useState<string[]>([]);

  // Get display value for a tag (translated if it's a master data code)
  const getTagDisplay = (tag: string) => {
    // First check if it's a language code
    const language = SUPPORTED_LANGUAGES.find((lang) => lang.code === tag);
    if (language) return language.display;

    // Check in each master data type
    const majorItem = majors?.find((m) => m.code === tag);
    if (majorItem) return majorItem.translations[i18n.language] || majorItem.translations.en;

    const courseCodeItem = courseCodes?.find((m) => m.code === tag);
    if (courseCodeItem) return courseCodeItem.translations[i18n.language] || courseCodeItem.translations.en;

    const levelItem = levels?.find((l) => l.code === tag);
    if (levelItem) return levelItem.translations[i18n.language] || levelItem.translations.en;

    const categoryItem = categories?.find((c) => c.code === tag);
    if (categoryItem) return categoryItem.translations[i18n.language] || categoryItem.translations.en;

    return tag;
  };

  useEffect(() => {
    if (majors?.length === 0 || courseCodes?.length === 0 || levels?.length === 0 || categories?.length === 0) {
      dispatch(fetchMasterData());
    }
  }, [dispatch, majors?.length, courseCodes?.length, levels?.length, categories?.length]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const prefsRes = await documentService.getDocumentPreferences();
        setPreferences(prefsRes.data);

        const [weightsRes, statsRes, tagsRes] = await Promise.all([
          documentService.getDocumentContentWeights(),
          documentService.getInteractionStatistics(),
          documentService.getRecommendedTags(),
        ]);
        setWeights(
          Object.entries(weightsRes.data).map(([type, weight]) => ({
            type,
            weight: weight as number,
          })),
        );
        setStats(statsRes.data);
        setRecommendedTags(tagsRes.data);
      } catch (_error) {
        toast({
          title: t("common.error"),
          description: t("document.preferences.fetchError"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSave = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      await documentService.updateDocumentPreferences({
        preferredMajors: Array.from(preferences.preferredMajors || []),
        preferredLevels: Array.from(preferences.preferredLevels || []),
        preferredCategories: Array.from(preferences.preferredCategories || []),
        preferredTags: Array.from(preferences.preferredTags || []),
        languagePreferences: Array.from(preferences.languagePreferences || []),
      });
      toast({
        title: t("common.success"),
        description: t("document.preferences.updateSuccess"),
        variant: "success",
      });
    } catch (_error) {
      toast({
        title: t("common.error"),
        description: t("document.preferences.updateError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || masterDataLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="preferences" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preferences">{t("document.preferences.tabs.preferences")}</TabsTrigger>
          <TabsTrigger value="analytics">{t("document.preferences.tabs.analytics")}</TabsTrigger>
        </TabsList>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>{t("document.preferences.contentPreferences.title")}</CardTitle>
              <CardDescription>{t("document.preferences.contentPreferences.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Language Preferences */}
              <div className="space-y-2">
                <Label>{t("document.preferences.contentPreferences.language.label")}</Label>
                <TagInput
                  value={Array.from(preferences?.languagePreferences || [])}
                  onChange={(languages) =>
                    setPreferences((prev) => ({
                      ...prev,
                      languagePreferences: new Set(languages),
                    }))
                  }
                  recommendedTags={SUPPORTED_LANGUAGES.map((lang) => lang.code)}
                  getTagDisplay={getTagDisplay}
                  placeholder={t("document.preferences.contentPreferences.language.placeholder")}
                />
              </div>

              {/* Preferred Majors */}
              <div className="space-y-2">
                <Label>{t("document.preferences.contentPreferences.majors.label")}</Label>
                <TagInput
                  value={Array.from(preferences?.preferredMajors || [])}
                  onChange={(majors) =>
                    setPreferences((prev) => ({
                      ...prev,
                      preferredMajors: new Set(majors),
                    }))
                  }
                  recommendedTags={majors?.map((major) => major.code) || []}
                  getTagDisplay={getTagDisplay}
                  placeholder={t("document.preferences.contentPreferences.majors.placeholder")}
                />
              </div>

              {/* Preferred Course Codes */}
              <div className="space-y-2">
                <Label>{t("document.preferences.contentPreferences.courseCode.label")}</Label>
                <TagInput
                  value={Array.from(preferences?.preferredCourseCodes || [])}
                  onChange={(course) =>
                    setPreferences((prev) => ({
                      ...prev,
                      preferredCourseCodes: new Set(course),
                    }))
                  }
                  recommendedTags={courseCodes?.map((course) => course.code) || []}
                  getTagDisplay={getTagDisplay}
                  placeholder={t("document.preferences.contentPreferences.courseCode.placeholder")}
                />
              </div>

              {/* Preferred Levels */}
              <div className="space-y-2">
                <Label>{t("document.preferences.contentPreferences.levels.label")}</Label>
                <TagInput
                  value={Array.from(preferences?.preferredLevels || [])}
                  onChange={(levels) =>
                    setPreferences((prev) => ({
                      ...prev,
                      preferredLevels: new Set(levels),
                    }))
                  }
                  recommendedTags={levels?.map((level) => level.code) || []}
                  getTagDisplay={getTagDisplay}
                  placeholder={t("document.preferences.contentPreferences.levels.placeholder")}
                />
              </div>

              {/* Preferred Categories */}
              <div className="space-y-2">
                <Label>{t("document.preferences.contentPreferences.categories.label")}</Label>
                <TagInput
                  value={Array.from(preferences?.preferredCategories || [])}
                  onChange={(categories) =>
                    setPreferences((prev) => ({
                      ...prev,
                      preferredCategories: new Set(categories),
                    }))
                  }
                  recommendedTags={categories?.map((category) => category.code) || []}
                  getTagDisplay={getTagDisplay}
                  placeholder={t("document.preferences.contentPreferences.categories.placeholder")}
                />
              </div>

              {/* Preferred Tags */}
              <div className="space-y-2">
                <Label>{t("document.preferences.contentPreferences.tags.label")}</Label>
                <TagInput
                  value={Array.from(preferences?.preferredTags || [])}
                  onChange={(tags) =>
                    setPreferences((prev) => ({
                      ...prev,
                      preferredTags: new Set(tags),
                    }))
                  }
                  recommendedTags={recommendedTags}
                  placeholder={t("document.preferences.contentPreferences.tags.placeholder")}
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {t("document.preferences.actions.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>{t("document.preferences.analytics.title")}</CardTitle>
              <CardDescription>{t("document.preferences.analytics.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Content Type Weights */}
              <div className="space-y-4">
                <Label>{t("document.preferences.analytics.weights.label")}</Label>
                <ScrollArea className="h-72 rounded-md border p-4">
                  <div className="space-y-2">
                    {weights.map(({ type, weight }) => (
                      <div key={type} className="flex items-center justify-between space-x-2">
                        <div className="flex-1">
                          <p className="font-medium">{type}</p>
                          <p className="text-sm text-muted-foreground">{getDescriptionType(type)}</p>
                        </div>
                        <div className="w-24 text-right">
                          <span className="text-sm font-medium">{(weight * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Interaction Statistics */}
              {stats && (
                <div className="space-y-4">
                  <Label>{t("document.preferences.analytics.stats.label")}</Label>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border p-3">
                      <div className="text-sm font-medium text-muted-foreground">
                        {t("document.preferences.analytics.stats.uniqueDocuments")}
                      </div>
                      <div className="text-2xl font-bold">{stats.uniqueDocumentsAccessed || 0}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm font-medium text-muted-foreground">
                        {t("document.preferences.analytics.stats.downloads")}
                      </div>
                      <div className="text-2xl font-bold">{stats.interactionCounts?.DOWNLOAD || 0}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm font-medium text-muted-foreground">
                        {t("document.preferences.analytics.stats.comments")}
                      </div>
                      <div className="text-2xl font-bold">{stats.interactionCounts?.COMMENT || 0}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
