# Web / Flutter component acceptance inventory

Every row requires matching native rendering, interaction, data contract, light/dark, 320/390px, keyboard and overlay states. An existing Dart implementation or passing fixture test does not mark parity accepted. System-owned keyboard/status bars are outside app component rendering; app layout must account for their insets.

| Web source | Work remaining | Acceptance |
| --- | --- | --- |
| `components/AppBootSplash.tsx` | Pending source/native/state comparison | Not accepted |
| `components/CodeBlock.tsx` | Prism tokens match Web fixtures on macOS; Android runtime verified. Native theme/collapse/wrap/download implemented; visual theme matrix pending | Not accepted |
| `components/FluentEmoji.tsx` | Pending source/native/state comparison | Not accepted |
| `components/GlobalTooltip.tsx` | Pending source/native/state comparison | Not accepted |
| `components/MarkAILoadingScreen.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ThemeProvider.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ThemeToggle.tsx` | Pending source/native/state comparison | Not accepted |
| `components/admin/AdminChart.tsx` | Deferred at user request | Out of current scope |
| `components/admin/AdminConsole.tsx` | Deferred at user request | Out of current scope |
| `components/admin/AdminPrimitives.tsx` | Deferred at user request | Out of current scope |
| `components/admin/AuditPanel.tsx` | Deferred at user request | Out of current scope |
| `components/admin/OverviewPanel.tsx` | Deferred at user request | Out of current scope |
| `components/admin/UserDetailDialog.tsx` | Deferred at user request | Out of current scope |
| `components/admin/UsersPanel.tsx` | Deferred at user request | Out of current scope |
| `components/admin/WaitlistPanel.tsx` | Deferred at user request | Out of current scope |
| `components/chat/AgentAvatar.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ChatApp.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ChatInput.tsx` | Mobile spacing and Enter/Mod+Enter, image-model controls restored; attachment cards/desktop variants and full keyboard matrix pending | Not accepted |
| `components/chat/ChatMiniMap.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/CollapsibleContent.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/CommandCenter.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ComposerAttachments.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ContextWindowIndicator.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/EChartsPreviewBlock.tsx` | Shared Web validation/themes; native controls, expansion and PNG export; Android light/dark fixtures pass | Not accepted |
| `components/chat/ExportDialog.tsx` | Native image/JSON preview and save; complete conversation raster with chart snapshots verified | Not accepted |
| `components/chat/FileAccessContext.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/FileManagerDrawer.tsx` | Upload/download/delete and native rows retained; image/text preview policy centralized; Office/PDF disabled | Not accepted |
| `components/chat/FilePreviewDialog.tsx` | Image/text preview retained; PDF/Office explicitly disabled, download retained | Not accepted |
| `components/chat/FirstTokenLoader.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/FloatingMenu.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/HtmlPreviewBlock.tsx` | Native HTML card and preview/source header restored; desktop split layout and streaming handoff pending | Not accepted |
| `components/chat/HtmlPreviewContext.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/HtmlPreviewPanel.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ImageGenerationSkeleton.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/MarkdownContent.tsx` | Native complex TeX, structured citations, tables/lists, admonitions/task lists and fade; tested fixtures pass | Not accepted |
| `components/chat/MarkmapPreviewBlock.tsx` | Shared Web validation/styles/folding; pan, zoom, full-tree SVG/PNG export; Android fixtures pass | Not accepted |
| `components/chat/MermaidPreviewBlock.tsx` | Shared Web validation/config; native controls, SVG/PNG export; Android fixtures pass | Not accepted |
| `components/chat/MessageActionButton.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/MessageAudioPlayer.tsx` | Native player/voice/progress/pause/replay; cancellation and real Android audio plugin verified | Not accepted |
| `components/chat/MessageItem.tsx` | Timestamp, avatar, compact actions and inline edit restored; rich artifacts/menu geometry and all content fixtures pending | Not accepted |
| `components/chat/MessageSelectionWrapper.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ModelAvatar.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ModelBrandIcon.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ModelSelectorDialog.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ProfileDialog.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ReadonlyConversation.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/SelectToHereButton.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/SelectionFooterBar.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/SelectionQuoteAction.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/SessionGroupHeader.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/SessionRow.tsx` | Inline title edit and target-session automatic naming implemented; menu layering/favorite fill/status indicators still pending | Not accepted |
| `components/chat/SessionSearchDialog.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/SettingsDialog.tsx` | Four sections, 12px mobile frame, profile/provider APIs and native number field implemented; slider/tabs/desktop navigation parity pending | Not accepted |
| `components/chat/ShareConversationDialog.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/SharedConversationContent.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/Sidebar.tsx` | Native push transition and 260px grouping implemented; avatar/account menu/desktop resizing still pending | Not accepted |
| `components/chat/SidebarNavItem.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ThinkingPanel.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ToolMenu.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/ToolPreviewCard.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/TopHeader.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/UserAccountMenu.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/WelcomePanel.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/WordDocumentLivePreview.tsx` | Disabled on Android at user request; generation and download remain available | Not accepted |
| `components/chat/files/FileTypeIcon.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/files/ManagedFileRow.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/message/GeneratedFileToolBlock.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/message/GeneratedImageBlock.tsx` | Native image-only block restored; unified image preview/download; redundant Material row removed | Not accepted |
| `components/chat/message/MessageSources.tsx` | Native numbered references, URL deduplication, expandable sources and anchored preview; light/dark interaction tested | Not accepted |
| `components/chat/message/WebSearchToolBlock.tsx` | Pending source/native/state comparison | Not accepted |
| `components/chat/settings/GeneralSettingsSections.tsx` | Pending source/native/state comparison | Not accepted |
| `components/guest/GuestChatApp.tsx` | Pending source/native/state comparison | Not accepted |
| `components/icons/GlobeOffIcon.tsx` | Pending source/native/state comparison | Not accepted |
| `components/onboarding/OnboardingShell.tsx` | Pending source/native/state comparison | Not accepted |
| `components/tools/PluginCenterDrawer.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ui/AppDialog.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ui/AppInput.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ui/AppNumberInput.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ui/AppSelect.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ui/AppSliderWithInput.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ui/ConfirmDialog.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ui/DropdownSurface.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ui/IconButton.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ui/InlineTextEdit.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ui/MenuAction.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ui/SegmentedControl.tsx` | Pending source/native/state comparison | Not accepted |
| `components/ui/ToggleSwitch.tsx` | Pending source/native/state comparison | Not accepted |

## Routes

- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `app/(auth)/reset-password/page.tsx`
- `app/[sessionId]/page.tsx`
- `app/admin/page.tsx`
- `app/onboarding/age/page.tsx`
- `app/onboarding/avatar/page.tsx`
- `app/onboarding/name/page.tsx`
- `app/page.tsx`
- `app/plugins/page.tsx`
- `app/share/[token]/page.tsx`
