export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      academy_classes: {
        Row: {
          active: boolean
          age_group_id: string
          branch_id: string
          capacity: number
          coach_id: string
          created_at: string
          duration_minutes: number
          id: string
          level_id: string
          local_time: string
          name: string
          sport: Database["public"]["Enums"]["sport_id"]
          synthetic: boolean
          timezone: string
          venue_id: string
          weekdays: number[]
        }
        Insert: {
          active?: boolean
          age_group_id: string
          branch_id: string
          capacity: number
          coach_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          level_id: string
          local_time: string
          name: string
          sport: Database["public"]["Enums"]["sport_id"]
          synthetic?: boolean
          timezone?: string
          venue_id: string
          weekdays: number[]
        }
        Update: {
          active?: boolean
          age_group_id?: string
          branch_id?: string
          capacity?: number
          coach_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          level_id?: string
          local_time?: string
          name?: string
          sport?: Database["public"]["Enums"]["sport_id"]
          synthetic?: boolean
          timezone?: string
          venue_id?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "academy_classes_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_classes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_classes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_classes_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_classes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_events: {
        Row: {
          age_group_id: string
          branch_id: string
          cancellation_reason: string | null
          capacity: number
          created_at: string
          created_by: string
          document_id: string
          ends_at: string
          event_kind: string
          id: string
          level_id: string
          policy_version: string
          sport: Database["public"]["Enums"]["sport_id"]
          starts_at: string
          status: string
          synthetic: boolean
          title: string
          venue_id: string
        }
        Insert: {
          age_group_id: string
          branch_id: string
          cancellation_reason?: string | null
          capacity: number
          created_at?: string
          created_by: string
          document_id: string
          ends_at: string
          event_kind?: string
          id?: string
          level_id: string
          policy_version?: string
          sport: Database["public"]["Enums"]["sport_id"]
          starts_at: string
          status?: string
          synthetic?: boolean
          title: string
          venue_id: string
        }
        Update: {
          age_group_id?: string
          branch_id?: string
          cancellation_reason?: string | null
          capacity?: number
          created_at?: string
          created_by?: string
          document_id?: string
          ends_at?: string
          event_kind?: string
          id?: string
          level_id?: string
          policy_version?: string
          sport?: Database["public"]["Enums"]["sport_id"]
          starts_at?: string
          status?: string
          synthetic?: boolean
          title?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_events_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_events_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_policies: {
        Row: {
          allow_absent: boolean
          allow_excused: boolean
          branch_id: string
          created_at: string
          id: string
          makeup_days: number
          name: string
          synthetic: boolean
          version: number
        }
        Insert: {
          allow_absent?: boolean
          allow_excused?: boolean
          branch_id: string
          created_at?: string
          id?: string
          makeup_days: number
          name: string
          synthetic?: boolean
          version: number
        }
        Update: {
          allow_absent?: boolean
          allow_excused?: boolean
          branch_id?: string
          created_at?: string
          id?: string
          makeup_days?: number
          name?: string
          synthetic?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_policies_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      age_groups: {
        Row: {
          id: string
          max_age: number
          min_age: number
          name: string
        }
        Insert: {
          id?: string
          max_age: number
          min_age: number
          name: string
        }
        Update: {
          id?: string
          max_age?: number
          min_age?: number
          name?: string
        }
        Relationships: []
      }
      attendance_corrections: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          new_status: string
          previous_status: string
          reason: string
          roster_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          new_status: string
          previous_status: string
          reason: string
          roster_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          new_status?: string
          previous_status?: string
          reason?: string
          roster_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "session_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          new_value: Json | null
          previous_value: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      branch_permissions: {
        Row: {
          branch_id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          user_id: string
        }
        Update: {
          branch_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_permissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_sports: {
        Row: {
          branch_id: string
          sport: Database["public"]["Enums"]["sport_id"]
        }
        Insert: {
          branch_id: string
          sport: Database["public"]["Enums"]["sport_id"]
        }
        Update: {
          branch_id?: string
          sport?: Database["public"]["Enums"]["sport_id"]
        }
        Relationships: [
          {
            foreignKeyName: "branch_sports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          active: boolean
          area: string
          id: string
          name: string
          name_ar: string
          organization_id: string
          provisional: boolean
          slug: string
          synthetic: boolean
        }
        Insert: {
          active?: boolean
          area?: string
          id?: string
          name: string
          name_ar?: string
          organization_id?: string
          provisional?: boolean
          slug: string
          synthetic?: boolean
        }
        Update: {
          active?: boolean
          area?: string
          id?: string
          name?: string
          name_ar?: string
          organization_id?: string
          provisional?: boolean
          slug?: string
          synthetic?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      child_sports: {
        Row: {
          child_id: string
          id: string
          level: string | null
          level_id: string | null
          sport: Database["public"]["Enums"]["sport_id"]
          status: string
        }
        Insert: {
          child_id: string
          id?: string
          level?: string | null
          level_id?: string | null
          sport: Database["public"]["Enums"]["sport_id"]
          status?: string
        }
        Update: {
          child_id?: string
          id?: string
          level?: string | null
          level_id?: string | null
          sport?: Database["public"]["Enums"]["sport_id"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_sports_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_sports_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          age_captured_on: string | null
          created_at: string
          dob: string | null
          family_id: string
          id: string
          name: string
          reported_age: number | null
          synthetic: boolean
        }
        Insert: {
          age_captured_on?: string | null
          created_at?: string
          dob?: string | null
          family_id: string
          id?: string
          name: string
          reported_age?: number | null
          synthetic?: boolean
        }
        Update: {
          age_captured_on?: string | null
          created_at?: string
          dob?: string | null
          family_id?: string
          id?: string
          name?: string
          reported_age?: number | null
          synthetic?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "children_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          cancellation_reason: string | null
          capacity: number
          class_id: string
          delivered_at: string | null
          delivered_by: string | null
          ends_at: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          starts_at: string
          status: string
        }
        Insert: {
          cancellation_reason?: string | null
          capacity: number
          class_id: string
          delivered_at?: string | null
          delivered_by?: string | null
          ends_at: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          starts_at: string
          status?: string
        }
        Update: {
          cancellation_reason?: string | null
          capacity?: number
          class_id?: string
          delivered_at?: string | null
          delivered_by?: string | null
          ends_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "academy_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_assignments: {
        Row: {
          active: boolean
          branch_id: string
          coach_id: string
          created_at: string
          id: string
          level_id: string | null
          sport: Database["public"]["Enums"]["sport_id"]
          venue_id: string | null
        }
        Insert: {
          active?: boolean
          branch_id: string
          coach_id: string
          created_at?: string
          id?: string
          level_id?: string | null
          sport: Database["public"]["Enums"]["sport_id"]
          venue_id?: string | null
        }
        Update: {
          active?: boolean
          branch_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          level_id?: string | null
          sport?: Database["public"]["Enums"]["sport_id"]
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignments_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability: {
        Row: {
          branch_id: string | null
          coach_id: string
          created_at: string
          end_time: string
          id: string
          start_time: string
          weekday: number
        }
        Insert: {
          branch_id?: string | null
          coach_id: string
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          weekday: number
        }
        Update: {
          branch_id?: string | null
          coach_id?: string
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_conversations: {
        Row: {
          created_at: string
          created_by: string
          enrollment_id: string
          escalated_at: string | null
          id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          enrollment_id: string
          escalated_at?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          enrollment_id?: string
          escalated_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_conversations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_message_policies: {
        Row: {
          approved_by: string
          branch_id: string
          created_at: string
          enabled: boolean
          id: string
          oversight: boolean
          review_required: boolean
          version: number
        }
        Insert: {
          approved_by: string
          branch_id: string
          created_at?: string
          enabled: boolean
          id?: string
          oversight?: boolean
          review_required?: boolean
          version: number
        }
        Update: {
          approved_by?: string
          branch_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          oversight?: boolean
          review_required?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_message_policies_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_message_policies_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "coach_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_messages: {
        Row: {
          author_id: string
          body: string
          conversation_id: string
          created_at: string
          id: string
          policy_id: string
          published_at: string | null
          request_key: string
          reviewed_by: string | null
          status: string
        }
        Insert: {
          author_id: string
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          policy_id: string
          published_at?: string | null
          request_key: string
          reviewed_by?: string | null
          status: string
        }
        Update: {
          author_id?: string
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          policy_id?: string
          published_at?: string | null
          request_key?: string
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "coach_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "coach_message_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_substitutions: {
        Row: {
          coach_id: string
          created_at: string
          ends_at: string
          id: string
          reason: string
          revoked_at: string | null
          session_id: string
          starts_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          ends_at: string
          id?: string
          reason: string
          revoked_at?: string | null
          session_id: string
          starts_at: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string
          revoked_at?: string | null
          session_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_substitutions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_substitutions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_adjustments: {
        Row: {
          amount_minor: number
          created_at: string
          created_by: string
          id: string
          invoice_id: string
          kind: string
          reason: string
          reversal_of: string | null
        }
        Insert: {
          amount_minor: number
          created_at?: string
          created_by: string
          id?: string
          invoice_id: string
          kind: string
          reason: string
          reversal_of?: string | null
        }
        Update: {
          amount_minor?: number
          created_at?: string
          created_by?: string
          id?: string
          invoice_id?: string
          kind?: string
          reason?: string
          reversal_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_adjustments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "commercial_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_adjustments_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: true
            referencedRelation: "commercial_adjustments"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_allocations: {
        Row: {
          amount_minor: number
          created_at: string
          created_by: string
          id: string
          invoice_id: string
          payment_id: string
          reason: string | null
          reversal_of: string | null
        }
        Insert: {
          amount_minor: number
          created_at?: string
          created_by: string
          id?: string
          invoice_id: string
          payment_id: string
          reason?: string | null
          reversal_of?: string | null
        }
        Update: {
          amount_minor?: number
          created_at?: string
          created_by?: string
          id?: string
          invoice_id?: string
          payment_id?: string
          reason?: string | null
          reversal_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "commercial_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "commercial_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_allocations_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "commercial_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_cancellation_previews: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          membership_id: string
          policy: string
          policy_version: string
          snapshot: Json
          state_hash: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          membership_id: string
          policy: string
          policy_version?: string
          snapshot: Json
          state_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          membership_id?: string
          policy?: string
          policy_version?: string
          snapshot?: Json
          state_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_cancellation_previews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_cancellation_previews_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "commercial_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_compensation_accruals: {
        Row: {
          amount_minor: number
          branch_id: string
          coach_id: string
          created_at: string
          id: string
          period_start: string | null
          rate_id: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          status: string
          units: number
        }
        Insert: {
          amount_minor: number
          branch_id: string
          coach_id: string
          created_at?: string
          id?: string
          period_start?: string | null
          rate_id: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: string
          units?: number
        }
        Update: {
          amount_minor?: number
          branch_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          period_start?: string | null
          rate_id?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_compensation_accruals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_compensation_accruals_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_compensation_accruals_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "commercial_compensation_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_compensation_accruals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_compensation_accruals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_compensation_rates: {
        Row: {
          amount_minor: number
          basis: string
          branch_id: string
          cancellation_rule: string
          coach_id: string
          created_at: string
          created_by: string
          currency: string
          effective_from: string
          effective_to: string
          id: string
          sport: Database["public"]["Enums"]["sport_id"] | null
          substitute_rule: string
        }
        Insert: {
          amount_minor: number
          basis?: string
          branch_id: string
          cancellation_rule?: string
          coach_id: string
          created_at?: string
          created_by: string
          currency?: string
          effective_from: string
          effective_to: string
          id?: string
          sport?: Database["public"]["Enums"]["sport_id"] | null
          substitute_rule?: string
        }
        Update: {
          amount_minor?: number
          basis?: string
          branch_id?: string
          cancellation_rule?: string
          coach_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          effective_from?: string
          effective_to?: string
          id?: string
          sport?: Database["public"]["Enums"]["sport_id"] | null
          substitute_rule?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_compensation_rates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_compensation_rates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_compensation_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_compensation_settlements: {
        Row: {
          accrual_id: string
          amount_minor: number
          branch_id: string
          created_at: string
          currency: string
          id: string
          reason: string
          recorded_by: string
          reference: string
          reversal_of: string | null
        }
        Insert: {
          accrual_id: string
          amount_minor: number
          branch_id: string
          created_at?: string
          currency?: string
          id?: string
          reason: string
          recorded_by: string
          reference: string
          reversal_of?: string | null
        }
        Update: {
          accrual_id?: string
          amount_minor?: number
          branch_id?: string
          created_at?: string
          currency?: string
          id?: string
          reason?: string
          recorded_by?: string
          reference?: string
          reversal_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_compensation_settlements_accrual_id_fkey"
            columns: ["accrual_id"]
            isOneToOne: false
            referencedRelation: "commercial_compensation_accruals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_compensation_settlements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_compensation_settlements_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_compensation_settlements_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: true
            referencedRelation: "commercial_compensation_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_credit_approvals: {
        Row: {
          amount_minor: number
          approved_by: string
          created_at: string
          expires_on: string
          id: string
          invoice_id: string
          reason: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          amount_minor: number
          approved_by: string
          created_at?: string
          expires_on: string
          id?: string
          invoice_id: string
          reason: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          amount_minor?: number
          approved_by?: string
          created_at?: string
          expires_on?: string
          id?: string
          invoice_id?: string
          reason?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_credit_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_credit_approvals_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "commercial_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_credit_approvals_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_freezes: {
        Row: {
          created_at: string
          created_by: string
          frozen: boolean
          id: string
          membership_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by: string
          frozen: boolean
          id?: string
          membership_id: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string
          frozen?: boolean
          id?: string
          membership_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_freezes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_freezes_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "commercial_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_invoice_lines: {
        Row: {
          child_id: string | null
          created_at: string
          description: string
          description_ar: string
          id: string
          invoice_id: string
          line_position: number | null
          package_id: string | null
          quantity: number
          unit_minor: number
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          description: string
          description_ar?: string
          id?: string
          invoice_id: string
          line_position?: number | null
          package_id?: string | null
          quantity: number
          unit_minor: number
        }
        Update: {
          child_id?: string | null
          created_at?: string
          description?: string
          description_ar?: string
          id?: string
          invoice_id?: string
          line_position?: number | null
          package_id?: string | null
          quantity?: number
          unit_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_invoice_lines_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "commercial_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_invoice_lines_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "commercial_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_invoices: {
        Row: {
          author_reference: string | null
          branch_id: string
          created_at: string
          currency: string
          family_id: string
          id: string
          issued_by: string
          membership_id: string | null
          reference: string
        }
        Insert: {
          author_reference?: string | null
          branch_id: string
          created_at?: string
          currency?: string
          family_id: string
          id?: string
          issued_by: string
          membership_id?: string | null
          reference?: string
        }
        Update: {
          author_reference?: string | null
          branch_id?: string
          created_at?: string
          currency?: string
          family_id?: string
          id?: string
          issued_by?: string
          membership_id?: string | null
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_invoices_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_invoices_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_invoices_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: true
            referencedRelation: "commercial_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_membership_cancellations: {
        Row: {
          adjustment_id: string | null
          created_at: string
          created_by: string
          credit_minor: number
          id: string
          membership_id: string
          preview_id: string
          reason: string
          released_payment_minor: number
        }
        Insert: {
          adjustment_id?: string | null
          created_at?: string
          created_by: string
          credit_minor: number
          id?: string
          membership_id: string
          preview_id: string
          reason: string
          released_payment_minor: number
        }
        Update: {
          adjustment_id?: string | null
          created_at?: string
          created_by?: string
          credit_minor?: number
          id?: string
          membership_id?: string
          preview_id?: string
          reason?: string
          released_payment_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_membership_cancellations_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "commercial_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_membership_cancellations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_membership_cancellations_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: true
            referencedRelation: "commercial_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_membership_cancellations_preview_id_fkey"
            columns: ["preview_id"]
            isOneToOne: true
            referencedRelation: "commercial_cancellation_previews"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_membership_extensions: {
        Row: {
          created_at: string
          created_by: string
          days: number
          freeze_id: string
          id: string
          membership_id: string
          new_expires_on: string
          operation_txid: number
          policy_version: string
          previous_expires_on: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by: string
          days: number
          freeze_id: string
          id?: string
          membership_id: string
          new_expires_on: string
          operation_txid?: number
          policy_version?: string
          previous_expires_on: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string
          days?: number
          freeze_id?: string
          id?: string
          membership_id?: string
          new_expires_on?: string
          operation_txid?: number
          policy_version?: string
          previous_expires_on?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_membership_extensions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_membership_extensions_freeze_id_fkey"
            columns: ["freeze_id"]
            isOneToOne: true
            referencedRelation: "commercial_freezes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_membership_extensions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "commercial_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_memberships: {
        Row: {
          accepted_at: string
          accepted_by: string
          branch_id: string
          child_id: string
          created_at: string
          expires_on: string
          family_id: string
          id: string
          package_id: string
          renewed_from: string | null
          sport: Database["public"]["Enums"]["sport_id"]
          starts_on: string
          status: string
        }
        Insert: {
          accepted_at?: string
          accepted_by: string
          branch_id: string
          child_id: string
          created_at?: string
          expires_on: string
          family_id: string
          id?: string
          package_id: string
          renewed_from?: string | null
          sport: Database["public"]["Enums"]["sport_id"]
          starts_on: string
          status?: string
        }
        Update: {
          accepted_at?: string
          accepted_by?: string
          branch_id?: string
          child_id?: string
          created_at?: string
          expires_on?: string
          family_id?: string
          id?: string
          package_id?: string
          renewed_from?: string | null
          sport?: Database["public"]["Enums"]["sport_id"]
          starts_on?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_memberships_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_memberships_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_memberships_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_memberships_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "commercial_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_memberships_renewed_from_fkey"
            columns: ["renewed_from"]
            isOneToOne: true
            referencedRelation: "commercial_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_packages: {
        Row: {
          active: boolean
          branch_id: string
          catalogue_id: string | null
          created_at: string
          created_by: string
          currency: string
          duration_months: number
          id: string
          level_id: string | null
          max_age: number
          min_age: number
          name: string
          name_ar: string
          policy_status: string
          price_minor: number
          session_allowance: number
          sport: Database["public"]["Enums"]["sport_id"]
          terms: string
          terms_ar: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          catalogue_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          duration_months?: number
          id?: string
          level_id?: string | null
          max_age?: number
          min_age?: number
          name: string
          name_ar?: string
          policy_status?: string
          price_minor: number
          session_allowance: number
          sport: Database["public"]["Enums"]["sport_id"]
          terms: string
          terms_ar?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          catalogue_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          duration_months?: number
          id?: string
          level_id?: string | null
          max_age?: number
          min_age?: number
          name?: string
          name_ar?: string
          policy_status?: string
          price_minor?: number
          session_allowance?: number
          sport?: Database["public"]["Enums"]["sport_id"]
          terms?: string
          terms_ar?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_packages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_packages_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "package_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_packages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_packages_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_payments: {
        Row: {
          amount_minor: number
          branch_id: string
          created_at: string
          currency: string
          family_id: string
          id: string
          method: string
          recorded_by: string
          reference: string
        }
        Insert: {
          amount_minor: number
          branch_id: string
          created_at?: string
          currency?: string
          family_id: string
          id?: string
          method: string
          recorded_by: string
          reference: string
        }
        Update: {
          amount_minor?: number
          branch_id?: string
          created_at?: string
          currency?: string
          family_id?: string
          id?: string
          method?: string
          recorded_by?: string
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_payments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_receipts: {
        Row: {
          created_at: string
          id: string
          payment_id: string
          reference: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_id: string
          reference?: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_id?: string
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "commercial_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_refunds: {
        Row: {
          amount_minor: number
          created_at: string
          id: string
          payment_id: string
          reason: string
          recorded_by: string
          reference: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          id?: string
          payment_id: string
          reason: string
          recorded_by: string
          reference: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          id?: string
          payment_id?: string
          reason?: string
          recorded_by?: string
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "commercial_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_refunds_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_renewal_reminders: {
        Row: {
          created_at: string
          due_on: string
          id: string
          membership_id: string
        }
        Insert: {
          created_at?: string
          due_on: string
          id?: string
          membership_id: string
        }
        Update: {
          created_at?: string
          due_on?: string
          id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_renewal_reminders_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: true
            referencedRelation: "commercial_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_batches: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          template_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          id?: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          template_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_batches_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_recipients: {
        Row: {
          batch_id: string
          family_id: string
          id: string
          notification_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          batch_id: string
          family_id: string
          id?: string
          notification_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          batch_id?: string
          family_id?: string
          id?: string
          notification_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_recipients_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "communication_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_recipients_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          language: string
          name: string
          purpose: string
          subject: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          language: string
          name: string
          purpose: string
          subject: string
          version: number
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          language?: string
          name?: string
          purpose?: string
          subject?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          actor_id: string
          created_at: string
          family_id: string
          granted: boolean
          id: string
          kind: string
          version: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          family_id: string
          granted: boolean
          id?: string
          kind: string
          version: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          family_id?: string
          granted?: boolean
          id?: string
          kind?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_outbox: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          event_id: string
          id: string
          last_error_code: string | null
          next_attempt_at: string | null
          recipient_id: string
          status: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          event_id: string
          id?: string
          last_error_code?: string | null
          next_attempt_at?: string | null
          recipient_id: string
          status?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          event_id?: string
          id?: string
          last_error_code?: string | null
          next_attempt_at?: string | null
          recipient_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_outbox_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "product_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_outbox_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      development_assessment_notes: {
        Row: {
          assessment_id: string
          internal_note: string
        }
        Insert: {
          assessment_id: string
          internal_note?: string
        }
        Update: {
          assessment_id?: string
          internal_note?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_assessment_notes_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "development_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      development_assessments: {
        Row: {
          author_id: string
          child_id: string
          created_at: string
          criteria_id: string
          id: string
          next_target: string
          published_at: string | null
          recommended_level_id: string | null
          reviewed_by: string | null
          scores: Json
          session_id: string
          status: string
          submitted_at: string | null
          summary: string
          updated_at: string
        }
        Insert: {
          author_id: string
          child_id: string
          created_at?: string
          criteria_id: string
          id?: string
          next_target?: string
          published_at?: string | null
          recommended_level_id?: string | null
          reviewed_by?: string | null
          scores?: Json
          session_id: string
          status?: string
          submitted_at?: string | null
          summary: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          child_id?: string
          created_at?: string
          criteria_id?: string
          id?: string
          next_target?: string
          published_at?: string | null
          recommended_level_id?: string | null
          reviewed_by?: string | null
          scores?: Json
          session_id?: string
          status?: string
          submitted_at?: string | null
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_assessments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_assessments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_assessments_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "development_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_assessments_recommended_level_id_fkey"
            columns: ["recommended_level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_assessments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_assessments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      development_automation_policies: {
        Row: {
          approved_by: string
          branch_id: string
          created_at: string
          enabled: boolean
          id: string
          kind: string
          title: string
          version: number
        }
        Insert: {
          approved_by: string
          branch_id: string
          created_at?: string
          enabled: boolean
          id?: string
          kind: string
          title: string
          version: number
        }
        Update: {
          approved_by?: string
          branch_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "development_automation_policies_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_automation_policies_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      development_certificate_revocations: {
        Row: {
          certificate_id: string
          reason: string
          revoked_at: string
          revoked_by: string
        }
        Insert: {
          certificate_id: string
          reason: string
          revoked_at?: string
          revoked_by: string
        }
        Update: {
          certificate_id?: string
          reason?: string
          revoked_at?: string
          revoked_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_certificate_revocations_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: true
            referencedRelation: "development_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_certificate_revocations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      development_certificates: {
        Row: {
          assessment_id: string
          automation_policy_id: string | null
          child_id: string
          id: string
          issued_at: string
          issued_by: string
          level_name: string
          recipient_name: string
          reference: string
          reissue_reason: string
          replaces_id: string | null
          sport: Database["public"]["Enums"]["sport_id"]
          title: string
          version: number
        }
        Insert: {
          assessment_id: string
          automation_policy_id?: string | null
          child_id: string
          id?: string
          issued_at?: string
          issued_by: string
          level_name: string
          recipient_name: string
          reference?: string
          reissue_reason?: string
          replaces_id?: string | null
          sport: Database["public"]["Enums"]["sport_id"]
          title: string
          version?: number
        }
        Update: {
          assessment_id?: string
          automation_policy_id?: string | null
          child_id?: string
          id?: string
          issued_at?: string
          issued_by?: string
          level_name?: string
          recipient_name?: string
          reference?: string
          reissue_reason?: string
          replaces_id?: string | null
          sport?: Database["public"]["Enums"]["sport_id"]
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "development_certificates_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "development_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_certificates_automation_policy_id_fkey"
            columns: ["automation_policy_id"]
            isOneToOne: false
            referencedRelation: "development_automation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_certificates_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_certificates_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_certificates_replaces_id_fkey"
            columns: ["replaces_id"]
            isOneToOne: true
            referencedRelation: "development_certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      development_criteria: {
        Row: {
          created_at: string
          created_by: string
          criteria: Json
          id: string
          level_id: string
          sport: Database["public"]["Enums"]["sport_id"]
          title: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          criteria: Json
          id?: string
          level_id: string
          sport: Database["public"]["Enums"]["sport_id"]
          title: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          criteria?: Json
          id?: string
          level_id?: string
          sport?: Database["public"]["Enums"]["sport_id"]
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "development_criteria_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_criteria_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      development_emergency_policies: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          enabled: boolean
          id: string
          minutes_before: number
          synthetic: boolean
          version: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          enabled: boolean
          id?: string
          minutes_before: number
          synthetic?: boolean
          version: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          minutes_before?: number
          synthetic?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "development_emergency_policies_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_emergency_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      development_level_history: {
        Row: {
          approved_by: string
          assessment_id: string
          child_id: string
          created_at: string
          from_level_id: string | null
          id: string
          reason: string
          sport: Database["public"]["Enums"]["sport_id"]
          to_level_id: string
        }
        Insert: {
          approved_by: string
          assessment_id: string
          child_id: string
          created_at?: string
          from_level_id?: string | null
          id?: string
          reason: string
          sport: Database["public"]["Enums"]["sport_id"]
          to_level_id: string
        }
        Update: {
          approved_by?: string
          assessment_id?: string
          child_id?: string
          created_at?: string
          from_level_id?: string | null
          id?: string
          reason?: string
          sport?: Database["public"]["Enums"]["sport_id"]
          to_level_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_level_history_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_level_history_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "development_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_level_history_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_level_history_from_level_id_fkey"
            columns: ["from_level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_level_history_to_level_id_fkey"
            columns: ["to_level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      development_level_reversals: {
        Row: {
          history_id: string
          id: string
          reason: string
          reversed_at: string
          reversed_by: string
        }
        Insert: {
          history_id: string
          id?: string
          reason: string
          reversed_at?: string
          reversed_by: string
        }
        Update: {
          history_id?: string
          id?: string
          reason?: string
          reversed_at?: string
          reversed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_level_reversals_history_id_fkey"
            columns: ["history_id"]
            isOneToOne: true
            referencedRelation: "development_level_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_level_reversals_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      development_reports: {
        Row: {
          author_id: string
          automation_policy_id: string | null
          child_id: string
          created_at: string
          evidence_ids: string[]
          id: string
          month: string
          published_at: string | null
          reviewed_by: string | null
          session_id: string
          sport: Database["public"]["Enums"]["sport_id"]
          status: string
          submitted_at: string | null
          summary: string
          version: number
        }
        Insert: {
          author_id: string
          automation_policy_id?: string | null
          child_id: string
          created_at?: string
          evidence_ids: string[]
          id?: string
          month: string
          published_at?: string | null
          reviewed_by?: string | null
          session_id: string
          sport: Database["public"]["Enums"]["sport_id"]
          status?: string
          submitted_at?: string | null
          summary: string
          version: number
        }
        Update: {
          author_id?: string
          automation_policy_id?: string | null
          child_id?: string
          created_at?: string
          evidence_ids?: string[]
          id?: string
          month?: string
          published_at?: string | null
          reviewed_by?: string | null
          session_id?: string
          sport?: Database["public"]["Enums"]["sport_id"]
          status?: string
          submitted_at?: string | null
          summary?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "development_reports_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_reports_automation_policy_id_fkey"
            columns: ["automation_policy_id"]
            isOneToOne: false
            referencedRelation: "development_automation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_reports_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      development_results: {
        Row: {
          assessment_id: string
          child_id: string
          criteria_id: string
          direction: string
          id: string
          label: string
          label_ar: string
          measured_at: string
          metric_key: string
          sport: Database["public"]["Enums"]["sport_id"]
          unit: string
          value: number
        }
        Insert: {
          assessment_id: string
          child_id: string
          criteria_id: string
          direction: string
          id?: string
          label: string
          label_ar?: string
          measured_at: string
          metric_key: string
          sport: Database["public"]["Enums"]["sport_id"]
          unit: string
          value: number
        }
        Update: {
          assessment_id?: string
          child_id?: string
          criteria_id?: string
          direction?: string
          id?: string
          label?: string
          label_ar?: string
          measured_at?: string
          metric_key?: string
          sport?: Database["public"]["Enums"]["sport_id"]
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "development_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "development_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_results_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_results_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "development_criteria"
            referencedColumns: ["id"]
          },
        ]
      }
      development_reviews: {
        Row: {
          assessment_id: string | null
          created_at: string
          decision: string
          id: string
          reason: string
          report_id: string | null
          reviewer_id: string
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          decision: string
          id?: string
          reason: string
          report_id?: string | null
          reviewer_id: string
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          decision?: string
          id?: string
          reason?: string
          report_id?: string | null
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_reviews_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "development_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_reviews_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "development_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      development_safety_instructions: {
        Row: {
          child_id: string
          id: string
          instructions: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          child_id: string
          id?: string
          instructions?: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          child_id?: string
          id?: string
          instructions?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_safety_instructions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_safety_instructions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      development_session_plans: {
        Row: {
          activities: string
          coach_id: string
          id: string
          internal_note: string
          objectives: string
          session_id: string
          updated_at: string
        }
        Insert: {
          activities: string
          coach_id: string
          id?: string
          internal_note?: string
          objectives: string
          session_id: string
          updated_at?: string
        }
        Update: {
          activities?: string
          coach_id?: string
          id?: string
          internal_note?: string
          objectives?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_session_plans_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_session_plans_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      development_target_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          target_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          target_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_target_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_target_events_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "development_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      development_target_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          reason: string
          result_id: string | null
          reviewer_id: string
          stage: string
          target_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          reason: string
          result_id?: string | null
          reviewer_id: string
          stage: string
          target_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          reason?: string
          result_id?: string | null
          reviewer_id?: string
          stage?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_target_reviews_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "development_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_target_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_target_reviews_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "development_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      development_targets: {
        Row: {
          author_id: string
          baseline_result_id: string
          baseline_value: number
          child_id: string
          completed_at: string | null
          completion_by: string | null
          completion_result_id: string | null
          created_at: string
          criteria_id: string
          direction: string
          due_on: string
          id: string
          label: string
          label_ar: string
          metric_key: string
          published_at: string | null
          reviewed_by: string | null
          session_id: string
          sport: Database["public"]["Enums"]["sport_id"]
          status: string
          target_value: number
          title: string
          unit: string
          updated_at: string
          withdrawal_reason: string | null
          withdrawn_at: string | null
        }
        Insert: {
          author_id: string
          baseline_result_id: string
          baseline_value: number
          child_id: string
          completed_at?: string | null
          completion_by?: string | null
          completion_result_id?: string | null
          created_at?: string
          criteria_id: string
          direction: string
          due_on: string
          id?: string
          label: string
          label_ar?: string
          metric_key: string
          published_at?: string | null
          reviewed_by?: string | null
          session_id: string
          sport: Database["public"]["Enums"]["sport_id"]
          status?: string
          target_value: number
          title: string
          unit: string
          updated_at?: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          author_id?: string
          baseline_result_id?: string
          baseline_value?: number
          child_id?: string
          completed_at?: string | null
          completion_by?: string | null
          completion_result_id?: string | null
          created_at?: string
          criteria_id?: string
          direction?: string
          due_on?: string
          id?: string
          label?: string
          label_ar?: string
          metric_key?: string
          published_at?: string | null
          reviewed_by?: string | null
          session_id?: string
          sport?: Database["public"]["Enums"]["sport_id"]
          status?: string
          target_value?: number
          title?: string
          unit?: string
          updated_at?: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_targets_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_targets_baseline_result_id_fkey"
            columns: ["baseline_result_id"]
            isOneToOne: false
            referencedRelation: "development_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_targets_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_targets_completion_by_fkey"
            columns: ["completion_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_targets_completion_result_id_fkey"
            columns: ["completion_result_id"]
            isOneToOne: false
            referencedRelation: "development_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_targets_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "development_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_targets_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_targets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_acceptances: {
        Row: {
          created_at: string
          document_id: string
          family_id: string
          granted: boolean
          guardian_id: string
          id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          family_id: string
          granted: boolean
          guardian_id: string
          id?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          family_id?: string
          granted?: boolean
          guardian_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acceptances_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acceptances_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          purpose: string
          synthetic: boolean
          title: string
          version: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          purpose: string
          synthetic?: boolean
          title: string
          version: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          purpose?: string
          synthetic?: boolean
          title?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_challenges: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          description: string
          ends_at: string
          id: string
          level_id: string | null
          published_at: string | null
          reward_policy_id: string
          rule: Json
          sport: Database["public"]["Enums"]["sport_id"]
          starts_at: string
          title: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          description: string
          ends_at: string
          id?: string
          level_id?: string | null
          published_at?: string | null
          reward_policy_id: string
          rule: Json
          sport: Database["public"]["Enums"]["sport_id"]
          starts_at: string
          title: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          description?: string
          ends_at?: string
          id?: string
          level_id?: string | null
          published_at?: string | null
          reward_policy_id?: string
          rule?: Json
          sport?: Database["public"]["Enums"]["sport_id"]
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_challenges_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_challenges_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_challenges_reward_policy_id_fkey"
            columns: ["reward_policy_id"]
            isOneToOne: false
            referencedRelation: "engagement_reward_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_completions: {
        Row: {
          entry_id: string
          evidence: Json
          id: string
          published_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string
        }
        Insert: {
          entry_id: string
          evidence: Json
          id?: string
          published_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
        }
        Update: {
          entry_id?: string
          evidence?: Json
          id?: string
          published_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_completions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "engagement_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_completions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_completions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_entries: {
        Row: {
          challenge_id: string
          child_id: string
          id: string
          joined_at: string
          joined_by: string
          status: string
        }
        Insert: {
          challenge_id: string
          child_id: string
          id?: string
          joined_at?: string
          joined_by: string
          status?: string
        }
        Update: {
          challenge_id?: string
          child_id?: string
          id?: string
          joined_at?: string
          joined_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_entries_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "engagement_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_entries_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_entries_joined_by_fkey"
            columns: ["joined_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_referral_campaigns: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          description: string
          ends_at: string
          id: string
          published_at: string | null
          qualification: string
          reward_policy_id: string
          starts_at: string
          title: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          description: string
          ends_at: string
          id?: string
          published_at?: string | null
          qualification?: string
          reward_policy_id: string
          starts_at: string
          title: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          description?: string
          ends_at?: string
          id?: string
          published_at?: string | null
          qualification?: string
          reward_policy_id?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_referral_campaigns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_referral_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_referral_campaigns_reward_policy_id_fkey"
            columns: ["reward_policy_id"]
            isOneToOne: false
            referencedRelation: "engagement_reward_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_referral_claims: {
        Row: {
          code_id: string
          created_at: string
          id: string
          published_at: string | null
          qualified_membership_id: string | null
          referred_family_id: string
          reviewed_by: string | null
          status: string
          submitted_by: string
        }
        Insert: {
          code_id: string
          created_at?: string
          id?: string
          published_at?: string | null
          qualified_membership_id?: string | null
          referred_family_id: string
          reviewed_by?: string | null
          status?: string
          submitted_by: string
        }
        Update: {
          code_id?: string
          created_at?: string
          id?: string
          published_at?: string | null
          qualified_membership_id?: string | null
          referred_family_id?: string
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_referral_claims_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "engagement_referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_referral_claims_qualified_membership_id_fkey"
            columns: ["qualified_membership_id"]
            isOneToOne: false
            referencedRelation: "commercial_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_referral_claims_referred_family_id_fkey"
            columns: ["referred_family_id"]
            isOneToOne: true
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_referral_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_referral_claims_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_referral_codes: {
        Row: {
          campaign_id: string
          code: string
          created_at: string
          created_by: string
          family_id: string
          id: string
        }
        Insert: {
          campaign_id: string
          code?: string
          created_at?: string
          created_by: string
          family_id: string
          id?: string
        }
        Update: {
          campaign_id?: string
          code?: string
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_referral_codes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "engagement_referral_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_referral_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_referral_codes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_reviews: {
        Row: {
          completion_id: string | null
          created_at: string
          decision: string
          id: string
          reason: string
          referral_id: string | null
          reviewer_id: string
        }
        Insert: {
          completion_id?: string | null
          created_at?: string
          decision: string
          id?: string
          reason: string
          referral_id?: string | null
          reviewer_id: string
        }
        Update: {
          completion_id?: string | null
          created_at?: string
          decision?: string
          id?: string
          reason?: string
          referral_id?: string | null
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_reviews_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "engagement_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_reviews_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "engagement_referral_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_reward_ledger: {
        Row: {
          child_id: string | null
          completion_id: string | null
          created_at: string
          created_by: string
          delta: number
          family_id: string
          id: string
          kind: string
          policy_id: string
          reason: string
          recognition_id: string | null
          referral_id: string | null
          reversal_of: string | null
          unit: string
        }
        Insert: {
          child_id?: string | null
          completion_id?: string | null
          created_at?: string
          created_by: string
          delta: number
          family_id: string
          id?: string
          kind: string
          policy_id: string
          reason: string
          recognition_id?: string | null
          referral_id?: string | null
          reversal_of?: string | null
          unit: string
        }
        Update: {
          child_id?: string | null
          completion_id?: string | null
          created_at?: string
          created_by?: string
          delta?: number
          family_id?: string
          id?: string
          kind?: string
          policy_id?: string
          reason?: string
          recognition_id?: string | null
          referral_id?: string | null
          reversal_of?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_reward_ledger_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_reward_ledger_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "engagement_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_reward_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_reward_ledger_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_reward_ledger_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "engagement_reward_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_reward_ledger_recognition_id_fkey"
            columns: ["recognition_id"]
            isOneToOne: false
            referencedRelation: "recognition_nominations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_reward_ledger_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "engagement_referral_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_reward_ledger_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: true
            referencedRelation: "engagement_reward_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_reward_rules: {
        Row: {
          branch_id: string
          code: string
          created_at: string
          created_by: string
          description: string
          id: string
          published_at: string | null
          quantity: number
          source_kind: string
          title: string
          unit: string
          version: number
        }
        Insert: {
          branch_id: string
          code: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          published_at?: string | null
          quantity: number
          source_kind: string
          title: string
          unit: string
          version: number
        }
        Update: {
          branch_id?: string
          code?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          published_at?: string | null
          quantity?: number
          source_kind?: string
          title?: string
          unit?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "engagement_reward_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_reward_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          child_id: string
          class_id: string
          enrolled_at: string
          id: string
          package_state: string
          status: string
          trial_booking_id: string | null
        }
        Insert: {
          child_id: string
          class_id: string
          enrolled_at?: string
          id?: string
          package_state?: string
          status?: string
          trial_booking_id?: string | null
        }
        Update: {
          child_id?: string
          class_id?: string
          enrolled_at?: string
          id?: string
          package_state?: string
          status?: string
          trial_booking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "academy_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_trial_booking_id_fkey"
            columns: ["trial_booking_id"]
            isOneToOne: true
            referencedRelation: "trial_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlement_ledger: {
        Row: {
          actor_id: string | null
          available_delta: number
          consumed_delta: number
          created_at: string
          id: string
          kind: string
          membership_id: string
          reason: string
          reserved_delta: number
          roster_id: string | null
          source_key: string
        }
        Insert: {
          actor_id?: string | null
          available_delta: number
          consumed_delta: number
          created_at?: string
          id?: string
          kind: string
          membership_id: string
          reason: string
          reserved_delta: number
          roster_id?: string | null
          source_key: string
        }
        Update: {
          actor_id?: string | null
          available_delta?: number
          consumed_delta?: number
          created_at?: string
          id?: string
          kind?: string
          membership_id?: string
          reason?: string
          reserved_delta?: number
          roster_id?: string | null
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlement_ledger_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlement_ledger_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "commercial_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlement_ledger_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "session_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendance: {
        Row: {
          attendance: string | null
          id: string
          occurrence_id: string
          recorded_by: string | null
          registration_id: string
          updated_at: string
        }
        Insert: {
          attendance?: string | null
          id?: string
          occurrence_id: string
          recorded_by?: string | null
          registration_id: string
          updated_at?: string
        }
        Update: {
          attendance?: string | null
          id?: string
          occurrence_id?: string
          recorded_by?: string | null
          registration_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "event_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendance_corrections: {
        Row: {
          attendance: string
          attendance_id: string
          corrected_by: string
          created_at: string
          id: string
          previous_attendance: string
          reason: string
        }
        Insert: {
          attendance: string
          attendance_id: string
          corrected_by: string
          created_at?: string
          id?: string
          previous_attendance: string
          reason: string
        }
        Update: {
          attendance?: string
          attendance_id?: string
          corrected_by?: string
          created_at?: string
          id?: string
          previous_attendance?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_corrections_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "event_attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_consents: {
        Row: {
          accepted_at: string
          child_id: string
          document_body: string
          document_id: string
          document_version: string
          family_id: string
          guardian_id: string
          id: string
          occurrence_snapshot: Json
          registration_id: string
        }
        Insert: {
          accepted_at?: string
          child_id: string
          document_body: string
          document_id: string
          document_version: string
          family_id: string
          guardian_id: string
          id?: string
          occurrence_snapshot?: Json
          registration_id: string
        }
        Update: {
          accepted_at?: string
          child_id?: string
          document_body?: string
          document_id?: string
          document_version?: string
          family_id?: string
          guardian_id?: string
          id?: string
          occurrence_snapshot?: Json
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_consents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_consents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_consents_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_consents_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_consents_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_occurrences: {
        Row: {
          cancellation_reason: string | null
          coach_id: string | null
          created_at: string
          ends_at: string
          event_id: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          position: number
          starts_at: string
          status: string
          venue_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          coach_id?: string | null
          created_at?: string
          ends_at: string
          event_id: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          position: number
          starts_at: string
          status?: string
          venue_id: string
        }
        Update: {
          cancellation_reason?: string | null
          coach_id?: string | null
          created_at?: string
          ends_at?: string
          event_id?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          position?: number
          starts_at?: string
          status?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_occurrences_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_occurrences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "academy_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_occurrences_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_occurrences_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registration_batches: {
        Row: {
          cancelled_at: string | null
          created_at: string
          event_id: string
          family_id: string
          guardian_id: string
          id: string
          status: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          event_id: string
          family_id: string
          guardian_id: string
          id?: string
          status?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          event_id?: string
          family_id?: string
          guardian_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registration_batches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "academy_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_batches_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_batches_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          batch_id: string
          child_id: string
          created_at: string
          event_id: string
          family_id: string
          id: string
          status: string
        }
        Insert: {
          batch_id: string
          child_id: string
          created_at?: string
          event_id: string
          family_id: string
          id?: string
          status?: string
        }
        Update: {
          batch_id?: string
          child_id?: string
          created_at?: string
          event_id?: string
          family_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "event_registration_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "academy_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          email: string
          id: string
          mobile: string
          name: string
          organization_id: string
          synthetic: boolean
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          mobile?: string
          name: string
          organization_id?: string
          synthetic?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          mobile?: string
          name?: string
          organization_id?: string
          synthetic?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "families_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      family_branches: {
        Row: {
          branch_id: string
          family_id: string
        }
        Insert: {
          branch_id: string
          family_id: string
        }
        Update: {
          branch_id?: string
          family_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_branches_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_emergency_contacts: {
        Row: {
          family_id: string
          id: string
          mobile: string
          name: string
          relationship: string
          updated_at: string
        }
        Insert: {
          family_id: string
          id?: string
          mobile: string
          name: string
          relationship: string
          updated_at?: string
        }
        Update: {
          family_id?: string
          id?: string
          mobile?: string
          name?: string
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_emergency_contacts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_files: {
        Row: {
          branch_id: string | null
          child_id: string | null
          created_at: string
          family_id: string
          id: string
          mime_type: string
          name: string
          object_path: string
          sha256: string
          size_bytes: number
          status: string
          uploaded_by: string
          withdrawn_at: string | null
        }
        Insert: {
          branch_id?: string | null
          child_id?: string | null
          created_at?: string
          family_id: string
          id?: string
          mime_type: string
          name: string
          object_path: string
          sha256: string
          size_bytes: number
          status?: string
          uploaded_by: string
          withdrawn_at?: string | null
        }
        Update: {
          branch_id?: string | null
          child_id?: string | null
          created_at?: string
          family_id?: string
          id?: string
          mime_type?: string
          name?: string
          object_path?: string
          sha256?: string
          size_bytes?: number
          status?: string
          uploaded_by?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_files_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_files_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_files_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_access_events: {
        Row: {
          action: string
          created_at: string
          file_id: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          file_id: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          file_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_access_events_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "family_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_access_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          family_id: string
          user_id: string
        }
        Insert: {
          family_id: string
          user_id: string
        }
        Update: {
          family_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          lead_id: string
          note: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          lead_id: string
          note: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          branch_id: string | null
          created_at: string
          duplicate_review: boolean
          email: string
          family_id: string | null
          follow_up_at: string | null
          id: string
          lost_reason: string | null
          mobile: string
          parent_name: string
          source: string
          stage: string
          synthetic: boolean
        }
        Insert: {
          assigned_to?: string | null
          branch_id?: string | null
          created_at?: string
          duplicate_review?: boolean
          email?: string
          family_id?: string | null
          follow_up_at?: string | null
          id?: string
          lost_reason?: string | null
          mobile: string
          parent_name: string
          source?: string
          stage?: string
          synthetic?: boolean
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string | null
          created_at?: string
          duplicate_review?: boolean
          email?: string
          family_id?: string | null
          follow_up_at?: string | null
          id?: string
          lost_reason?: string | null
          mobile?: string
          parent_name?: string
          source?: string
          stage?: string
          synthetic?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      makeup_bookings: {
        Row: {
          created_at: string
          credit_id: string
          id: string
          reference: string
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string
          credit_id: string
          id?: string
          reference?: string
          session_id: string
          status?: string
        }
        Update: {
          created_at?: string
          credit_id?: string
          id?: string
          reference?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "makeup_bookings_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "makeup_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      makeup_credits: {
        Row: {
          branch_id: string
          child_id: string
          created_at: string
          enrollment_id: string
          expires_at: string
          id: string
          level_id: string
          policy_id: string
          source_roster_id: string
          sport: Database["public"]["Enums"]["sport_id"]
          status: string
        }
        Insert: {
          branch_id: string
          child_id: string
          created_at?: string
          enrollment_id: string
          expires_at: string
          id?: string
          level_id: string
          policy_id: string
          source_roster_id: string
          sport: Database["public"]["Enums"]["sport_id"]
          status?: string
        }
        Update: {
          branch_id?: string
          child_id?: string
          created_at?: string
          enrollment_id?: string
          expires_at?: string
          id?: string
          level_id?: string
          policy_id?: string
          source_roster_id?: string
          sport?: Database["public"]["Enums"]["sport_id"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "makeup_credits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_credits_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_credits_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_credits_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_credits_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "academy_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_credits_source_roster_id_fkey"
            columns: ["source_roster_id"]
            isOneToOne: true
            referencedRelation: "session_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          event_id: string
          href: string
          id: string
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          href: string
          id?: string
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          href?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "product_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          roster_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          roster_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          roster_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_events_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "session_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_acknowledgements: {
        Row: {
          change_id: string
          created_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          change_id: string
          created_at?: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          change_id?: string
          created_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_acknowledgements_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: false
            referencedRelation: "session_changes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_acknowledgements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_acknowledgements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      package_catalogue: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          name_ar: string
          sport: Database["public"]["Enums"]["sport_id"]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          name_ar?: string
          sport: Database["public"]["Enums"]["sport_id"]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          name_ar?: string
          sport?: Database["public"]["Enums"]["sport_id"]
        }
        Relationships: [
          {
            foreignKeyName: "package_catalogue_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      package_offer_versions: {
        Row: {
          branch_id: string
          catalogue_id: string
          created_at: string
          package_id: string
          revision: number
        }
        Insert: {
          branch_id: string
          catalogue_id: string
          created_at?: string
          package_id: string
          revision: number
        }
        Update: {
          branch_id?: string
          catalogue_id?: string
          created_at?: string
          package_id?: string
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "package_offer_versions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_offer_versions_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "package_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_offer_versions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: true
            referencedRelation: "commercial_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          actor_id: string | null
          branch_id: string | null
          created_at: string
          entity_id: string
          family_id: string | null
          id: string
          kind: string
        }
        Insert: {
          actor_id?: string | null
          branch_id?: string | null
          created_at?: string
          entity_id: string
          family_id?: string | null
          id?: string
          kind: string
        }
        Update: {
          actor_id?: string | null
          branch_id?: string | null
          created_at?: string
          entity_id?: string
          family_id?: string | null
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      product_permissions: {
        Row: {
          branch_id: string | null
          created_at: string
          granted_by: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_permissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          bio: string
          created_at: string
          id: string
          mobile: string
          name: string
          organization_id: string
          qualifications: string[]
          synthetic: boolean
        }
        Insert: {
          active?: boolean
          bio?: string
          created_at?: string
          id: string
          mobile?: string
          name: string
          organization_id?: string
          qualifications?: string[]
          synthetic?: boolean
        }
        Update: {
          active?: boolean
          bio?: string
          created_at?: string
          id?: string
          mobile?: string
          name?: string
          organization_id?: string
          qualifications?: string[]
          synthetic?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recognition_nominations: {
        Row: {
          branch_id: string
          child_id: string
          created_at: string
          evidence: string
          id: string
          nominated_by: string
          review_reason: string | null
          reviewed_by: string | null
          status: string
          title: string
        }
        Insert: {
          branch_id: string
          child_id: string
          created_at?: string
          evidence: string
          id?: string
          nominated_by: string
          review_reason?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
        }
        Update: {
          branch_id?: string
          child_id?: string
          created_at?: string
          evidence?: string
          id?: string
          nominated_by?: string
          review_reason?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recognition_nominations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recognition_nominations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recognition_nominations_nominated_by_fkey"
            columns: ["nominated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recognition_nominations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_assignments: {
        Row: {
          role: Database["public"]["Enums"]["academy_role"]
          user_id: string
        }
        Insert: {
          role: Database["public"]["Enums"]["academy_role"]
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["academy_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_changes: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          kind: string
          new_value: Json
          previous_value: Json
          reason: string
          session_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          kind: string
          new_value: Json
          previous_value: Json
          reason: string
          session_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          kind?: string
          new_value?: Json
          previous_value?: Json
          reason?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_changes_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_changes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_roster: {
        Row: {
          attendance: string | null
          cancelled: boolean
          enrollment_id: string | null
          id: string
          kind: string
          makeup_booking_id: string | null
          session_id: string
          trial_booking_id: string | null
        }
        Insert: {
          attendance?: string | null
          cancelled?: boolean
          enrollment_id?: string | null
          id?: string
          kind: string
          makeup_booking_id?: string | null
          session_id: string
          trial_booking_id?: string | null
        }
        Update: {
          attendance?: string | null
          cancelled?: boolean
          enrollment_id?: string | null
          id?: string
          kind?: string
          makeup_booking_id?: string | null
          session_id?: string
          trial_booking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_roster_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_roster_makeup_booking_id_fkey"
            columns: ["makeup_booking_id"]
            isOneToOne: true
            referencedRelation: "makeup_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_roster_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_roster_trial_booking_id_fkey"
            columns: ["trial_booking_id"]
            isOneToOne: true
            referencedRelation: "trial_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_handovers: {
        Row: {
          assigned_to: string | null
          branch_id: string
          created_at: string
          created_by: string
          follow_up_at: string | null
          id: string
          note: string
          resolution: string | null
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          branch_id: string
          created_at?: string
          created_by: string
          follow_up_at?: string | null
          id?: string
          note: string
          resolution?: string | null
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string
          follow_up_at?: string | null
          id?: string
          note?: string
          resolution?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_handovers_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_handovers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_handovers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_levels: {
        Row: {
          active: boolean
          entry_level: boolean
          id: string
          name: string
          name_ar: string
          rank: number
          sport: Database["public"]["Enums"]["sport_id"]
        }
        Insert: {
          active?: boolean
          entry_level?: boolean
          id?: string
          name: string
          name_ar?: string
          rank: number
          sport: Database["public"]["Enums"]["sport_id"]
        }
        Update: {
          active?: boolean
          entry_level?: boolean
          id?: string
          name?: string
          name_ar?: string
          rank?: number
          sport?: Database["public"]["Enums"]["sport_id"]
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          auth_user_id: string | null
          branch_ids: string[]
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["academy_role"]
        }
        Insert: {
          accepted_at?: string | null
          auth_user_id?: string | null
          branch_ids?: string[]
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["academy_role"]
        }
        Update: {
          accepted_at?: string | null
          auth_user_id?: string | null
          branch_ids?: string[]
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["academy_role"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          branch_id: string
          child_id: string | null
          created_at: string
          family_id: string
          id: string
          invoice_id: string | null
          opened_by: string
          reference: string
          resolution: string | null
          session_id: string | null
          status: string
          subject: string
        }
        Insert: {
          assigned_to?: string | null
          branch_id: string
          child_id?: string | null
          created_at?: string
          family_id: string
          id?: string
          invoice_id?: string | null
          opened_by: string
          reference?: string
          resolution?: string | null
          session_id?: string | null
          status?: string
          subject: string
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string
          child_id?: string | null
          created_at?: string
          family_id?: string
          id?: string
          invoice_id?: string | null
          opened_by?: string
          reference?: string
          resolution?: string | null
          session_id?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "commercial_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_decisions: {
        Row: {
          approved_by: string
          created_at: string
          id: string
          new_enrollment_id: string | null
          reason: string
          request_id: string
        }
        Insert: {
          approved_by: string
          created_at?: string
          id?: string
          new_enrollment_id?: string | null
          reason: string
          request_id: string
        }
        Update: {
          approved_by?: string
          created_at?: string
          id?: string
          new_enrollment_id?: string | null
          reason?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_decisions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_decisions_new_enrollment_id_fkey"
            columns: ["new_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_decisions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "transfer_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_requests: {
        Row: {
          created_at: string
          enrollment_id: string
          id: string
          reason: string
          requested_by: string
          resolution: string | null
          resolved_by: string | null
          status: string
          target_class_id: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          id?: string
          reason: string
          requested_by: string
          resolution?: string | null
          resolved_by?: string | null
          status?: string
          target_class_id: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          id?: string
          reason?: string
          requested_by?: string
          resolution?: string | null
          resolved_by?: string | null
          status?: string
          target_class_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_target_class_id_fkey"
            columns: ["target_class_id"]
            isOneToOne: false
            referencedRelation: "academy_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_bookings: {
        Row: {
          booked_by: string | null
          created_at: string
          enquiry_id: string
          id: string
          level_id: string
          override_reason: string | null
          reference: string
          session_id: string
          status: string
        }
        Insert: {
          booked_by?: string | null
          created_at?: string
          enquiry_id: string
          id?: string
          level_id: string
          override_reason?: string | null
          reference?: string
          session_id: string
          status?: string
        }
        Update: {
          booked_by?: string | null
          created_at?: string
          enquiry_id?: string
          id?: string
          level_id?: string
          override_reason?: string | null
          reference?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_bookings_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_bookings_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "trial_enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_bookings_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_enquiries: {
        Row: {
          age_captured_on: string
          child_id: string | null
          child_name: string
          created_at: string
          experience: string
          id: string
          lead_id: string
          reference: string
          reported_age: number
          sport: Database["public"]["Enums"]["sport_id"]
          starting_level_id: string | null
          status: string
          submitted_by: string | null
        }
        Insert: {
          age_captured_on?: string
          child_id?: string | null
          child_name: string
          created_at?: string
          experience: string
          id?: string
          lead_id: string
          reference?: string
          reported_age: number
          sport: Database["public"]["Enums"]["sport_id"]
          starting_level_id?: string | null
          status?: string
          submitted_by?: string | null
        }
        Update: {
          age_captured_on?: string
          child_id?: string | null
          child_name?: string
          created_at?: string
          experience?: string
          id?: string
          lead_id?: string
          reference?: string
          reported_age?: number
          sport?: Database["public"]["Enums"]["sport_id"]
          starting_level_id?: string | null
          status?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_enquiries_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_enquiries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_enquiries_starting_level_id_fkey"
            columns: ["starting_level_id"]
            isOneToOne: false
            referencedRelation: "sport_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_enquiries_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string
          branch_id: string
          id: string
          name: string
          operating_information: string
        }
        Insert: {
          address: string
          branch_id: string
          id?: string
          name: string
          operating_information?: string
        }
        Update: {
          address?: string
          branch_id?: string
          id?: string
          name?: string
          operating_information?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          child_id: string
          created_at: string
          enrollment_id: string
          id: string
          offered_until: string | null
          session_id: string
          status: string
        }
        Insert: {
          child_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          offered_until?: string | null
          session_id: string
          status?: string
        }
        Update: {
          child_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          offered_until?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      development_certificate_records: {
        Row: {
          assessment_id: string | null
          branch_id: string | null
          child_id: string | null
          id: string | null
          issued_at: string | null
          level_name: string | null
          recipient_name: string | null
          reference: string | null
          reissue_reason: string | null
          replaces_id: string | null
          revocation_reason: string | null
          revoked_at: string | null
          sport: Database["public"]["Enums"]["sport_id"] | null
          title: string | null
          version: number | null
        }
        Relationships: []
      }
      development_coach_emergency_contacts: {
        Row: {
          child_id: string | null
          contact_name: string | null
          id: string | null
          mobile: string | null
          relationship: string | null
          session_id: string | null
        }
        Relationships: []
      }
      development_safety_children: {
        Row: {
          can_edit: boolean | null
          id: string | null
          instructions: string | null
          name: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      event_attendance_register: {
        Row: {
          attendance: string | null
          can_correct: boolean | null
          can_record: boolean | null
          child_id: string | null
          child_name: string | null
          event_id: string | null
          finalized_at: string | null
          id: string | null
          occurrence_id: string | null
          registration_id: string | null
          registration_status: string | null
        }
        Relationships: []
      }
      event_coach_directory: {
        Row: {
          branch_id: string | null
          coach_id: string | null
          id: string | null
          name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      academy_command: {
        Args: { p_action: string; p_data: Json }
        Returns: Json
      }
      account_context: { Args: never; Returns: Json }
      bootstrap_admin: { Args: { p_user_id: string }; Returns: undefined }
      branch_preferences: { Args: never; Returns: Json }
      branch_records: {
        Args: { p_branch: string; p_offset?: number; p_table: string }
        Returns: Json
      }
      business_report: {
        Args: {
          p_branch?: string
          p_from: string
          p_sport?: Database["public"]["Enums"]["sport_id"]
          p_to: string
        }
        Returns: Json
      }
      coach_attendance_sessions: { Args: never; Returns: Json }
      coach_conversation_command: {
        Args: { p_action: string; p_data: Json; p_key: string }
        Returns: Json
      }
      coach_conversation_options: { Args: never; Returns: Json }
      coach_directory: { Args: never; Returns: Json }
      coach_message_receipts: {
        Args: { p_conversation: string }
        Returns: Json
      }
      coach_sessions: { Args: never; Returns: Json }
      confirmed_locations: { Args: never; Returns: Json }
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_seconds: number }
        Returns: boolean
      }
      development_automation_configure: {
        Args: {
          p_branch: string
          p_enabled: boolean
          p_kind: string
          p_title: string
        }
        Returns: string
      }
      development_sessions: { Args: never; Returns: Json }
      family_schedule: { Args: never; Returns: Json }
      guest_trial: {
        Args: { p_enquiry: string; p_session?: string }
        Returns: Json
      }
      makeup_availability: { Args: { p_credit: string }; Returns: Json }
      management_earnings: {
        Args: { p_branch?: string; p_coach?: string; p_offset?: number }
        Returns: Json
      }
      management_finance: {
        Args: { p_branch?: string; p_from: string; p_to: string }
        Returns: Json
      }
      management_invoice: { Args: { p_id: string }; Returns: Json }
      management_invoices: {
        Args: {
          p_branch: string
          p_from: string
          p_offset?: number
          p_outstanding?: boolean
          p_query?: string
          p_to: string
        }
        Returns: Json
      }
      member_v1_actions: {
        Args: { p_child: string; p_id: string; p_kind: string }
        Returns: Json
      }
      member_v1_command: {
        Args: { p_action: string; p_data: Json; p_key: string }
        Returns: Json
      }
      member_v1_read: {
        Args: {
          p_child?: string
          p_limit?: number
          p_offset?: number
          p_resource: string
        }
        Returns: Json
      }
      member_v1_waitlist: {
        Args: { p_child: string }
        Returns: {
          actions: Json
          ends_at: string
          id: string
          starts_at: string
          title: string
        }[]
      }
      operations_command: {
        Args: { p_action: string; p_data: Json }
        Returns: Json
      }
      product_command: {
        Args: { p_action: string; p_data: Json; p_key: string }
        Returns: Json
      }
      registration_link: {
        Args: { p_action: string; p_data: Json }
        Returns: Json
      }
      scheduler_configure: {
        Args: {
          p_branch: string
          p_enabled: boolean
          p_reason: string
          p_target: string
        }
        Returns: string
      }
      scheduler_status: { Args: never; Returns: Json }
      staff_directory: { Args: never; Returns: Json }
      submit_enquiry: { Args: { p_data: Json; p_key: string }; Returns: Json }
      trial_availability: { Args: { p_enquiry: string }; Returns: Json }
      workspace_search: {
        Args: {
          p_after?: string
          p_branch?: string
          p_child?: string
          p_kinds?: string[]
          p_limit?: number
          p_query: string
        }
        Returns: Json
      }
      workspace_search_session: { Args: { p_id: string }; Returns: Json }
    }
    Enums: {
      academy_role:
        | "super_admin"
        | "admin"
        | "sales"
        | "branch"
        | "coach"
        | "parent"
      sport_id: "swimming" | "football" | "karate" | "badminton"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      academy_role: [
        "super_admin",
        "admin",
        "sales",
        "branch",
        "coach",
        "parent",
      ],
      sport_id: ["swimming", "football", "karate", "badminton"],
    },
  },
} as const

