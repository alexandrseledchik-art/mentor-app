export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      case_artifacts: {
        Row: {
          artifact_type: string;
          case_id: string;
          company_id: string | null;
          content_markdown: string;
          created_at: string;
          id: string;
          summary: string;
          title: string;
          user_id: string;
        };
        Insert: {
          artifact_type?: string;
          case_id: string;
          company_id?: string | null;
          content_markdown: string;
          created_at?: string;
          id?: string;
          summary: string;
          title: string;
          user_id: string;
        };
        Update: {
          artifact_type?: string;
          case_id?: string;
          company_id?: string | null;
          content_markdown?: string;
          created_at?: string;
          id?: string;
          summary?: string;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_artifacts_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_artifacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_artifacts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      case_messages: {
        Row: {
          case_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          role: string;
          text: string;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          role: string;
          text: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          role?: string;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_messages_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      case_results: {
        Row: {
          case_id: string;
          company_id: string | null;
          confidence_level: string | null;
          created_at: string;
          dominant_situation: string | null;
          id: string;
          main_constraint: string | null;
          structured_result: Json;
          user_id: string;
        };
        Insert: {
          case_id: string;
          company_id?: string | null;
          confidence_level?: string | null;
          created_at?: string;
          dominant_situation?: string | null;
          id?: string;
          main_constraint?: string | null;
          structured_result: Json;
          user_id: string;
        };
        Update: {
          case_id?: string;
          company_id?: string | null;
          confidence_level?: string | null;
          created_at?: string;
          dominant_situation?: string | null;
          id?: string;
          main_constraint?: string | null;
          structured_result?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_results_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: true;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_results_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_results_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      case_tool_recommendations: {
        Row: {
          case_id: string;
          created_at: string;
          id: string;
          reason_now: string;
          task_solved: string;
          tool_slug: string | null;
          tool_title: string;
          why_not_secondary: string | null;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          id?: string;
          reason_now: string;
          task_solved: string;
          tool_slug?: string | null;
          tool_title: string;
          why_not_secondary?: string | null;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          id?: string;
          reason_now?: string;
          task_solved?: string;
          tool_slug?: string | null;
          tool_title?: string;
          why_not_secondary?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "case_tool_recommendations_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      cases: {
        Row: {
          company_id: string | null;
          completed_at: string | null;
          created_at: string;
          current_stage: string;
          id: string;
          initial_message: string;
          public_share_token: string;
          source: string;
          status: string;
          turn_count: number;
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          company_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_stage?: string;
          id?: string;
          initial_message: string;
          public_share_token?: string;
          source?: string;
          status?: string;
          turn_count?: number;
          updated_at?: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          company_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_stage?: string;
          id?: string;
          initial_message?: string;
          public_share_token?: string;
          source?: string;
          status?: string;
          turn_count?: number;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cases_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cases_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cases_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          industry: string;
          is_active: boolean;
          name: string;
          onboarding_completed: boolean;
          primary_goal: string | null;
          revenue_range: string | null;
          team_size: string;
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          industry: string;
          is_active?: boolean;
          name: string;
          onboarding_completed?: boolean;
          primary_goal?: string | null;
          revenue_range?: string | null;
          team_size: string;
          updated_at?: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          industry?: string;
          is_active?: boolean;
          name?: string;
          onboarding_completed?: boolean;
          primary_goal?: string | null;
          revenue_range?: string | null;
          team_size?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "companies_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "companies_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      company_snapshots: {
        Row: {
          company_id: string;
          current_goal: string | null;
          dominant_situation: string | null;
          first_wave_summary: string | null;
          id: string;
          main_constraint: string | null;
          source_case_id: string | null;
          summary: string;
          tool_recommendations: Json;
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          company_id: string;
          current_goal?: string | null;
          dominant_situation?: string | null;
          first_wave_summary?: string | null;
          id?: string;
          main_constraint?: string | null;
          source_case_id?: string | null;
          summary: string;
          tool_recommendations?: Json;
          updated_at?: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          company_id?: string;
          current_goal?: string | null;
          dominant_situation?: string | null;
          first_wave_summary?: string | null;
          id?: string;
          main_constraint?: string | null;
          source_case_id?: string | null;
          summary?: string;
          tool_recommendations?: Json;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "company_snapshots_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_snapshots_source_case_id_fkey";
            columns: ["source_case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_snapshots_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_snapshots_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      diagnosis_answers: {
        Row: {
          answer_label: string | null;
          answer_value: number;
          created_at: string;
          diagnosis_session_id: string;
          id: string;
          question_id: string;
        };
        Insert: {
          answer_label?: string | null;
          answer_value: number;
          created_at?: string;
          diagnosis_session_id: string;
          id?: string;
          question_id: string;
        };
        Update: {
          answer_label?: string | null;
          answer_value?: number;
          created_at?: string;
          diagnosis_session_id?: string;
          id?: string;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "diagnosis_answers_diagnosis_session_id_fkey";
            columns: ["diagnosis_session_id"];
            isOneToOne: false;
            referencedRelation: "diagnosis_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diagnosis_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "diagnosis_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      diagnosis_question_sets: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          title: string;
          version: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          title: string;
          version?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          title?: string;
          version?: number;
        };
        Relationships: [];
      };
      diagnosis_questions: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          dimension: string;
          id: string;
          input_type: string;
          is_required: boolean;
          meta: Json;
          options: Json;
          order_index: number | null;
          position: number;
          question_text: string | null;
          question_set_id: string;
          title: string;
          weight: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          dimension: string;
          id?: string;
          input_type?: string;
          is_required?: boolean;
          meta?: Json;
          options?: Json;
          order_index?: number | null;
          position: number;
          question_text?: string | null;
          question_set_id: string;
          title: string;
          weight?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          dimension?: string;
          id?: string;
          input_type?: string;
          is_required?: boolean;
          meta?: Json;
          options?: Json;
          order_index?: number | null;
          position?: number;
          question_text?: string | null;
          question_set_id?: string;
          title?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "diagnosis_questions_question_set_id_fkey";
            columns: ["question_set_id"];
            isOneToOne: false;
            referencedRelation: "diagnosis_question_sets";
            referencedColumns: ["id"];
          },
        ];
      };
      diagnosis_sessions: {
        Row: {
          answers: Json | null;
          company_id: string;
          completed_at: string | null;
          created_at: string;
          current_step: number | null;
          id: string;
          question_set_id: string;
          score_overall: number | null;
          started_at: string | null;
          status: string;
          summary_key: string | null;
          total_score: number | null;
          updated_at: string;
          user_id: string | null;
          workspace_id: string | null;
        };
        Insert: {
          answers?: Json | null;
          company_id: string;
          completed_at?: string | null;
          created_at?: string;
          current_step?: number | null;
          id?: string;
          question_set_id: string;
          score_overall?: number | null;
          started_at?: string | null;
          status?: string;
          summary_key?: string | null;
          total_score?: number | null;
          updated_at?: string;
          user_id?: string | null;
          workspace_id?: string | null;
        };
        Update: {
          answers?: Json | null;
          company_id?: string;
          completed_at?: string | null;
          created_at?: string;
          current_step?: number | null;
          id?: string;
          question_set_id?: string;
          score_overall?: number | null;
          started_at?: string | null;
          status?: string;
          summary_key?: string | null;
          total_score?: number | null;
          updated_at?: string;
          user_id?: string | null;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "diagnosis_sessions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diagnosis_sessions_question_set_id_fkey";
            columns: ["question_set_id"];
            isOneToOne: false;
            referencedRelation: "diagnosis_question_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diagnosis_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diagnosis_sessions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      analytics_events: {
        Row: {
          company_id: string | null;
          created_at: string;
          diagnosis_session_id: string | null;
          entry_session_telegram_user_id: number | null;
          event_name: string;
          id: string;
          payload: Json;
          telegram_user_id: number | null;
          user_id: string | null;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          diagnosis_session_id?: string | null;
          entry_session_telegram_user_id?: number | null;
          event_name: string;
          id?: string;
          payload?: Json;
          telegram_user_id?: number | null;
          user_id?: string | null;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          diagnosis_session_id?: string | null;
          entry_session_telegram_user_id?: number | null;
          event_name?: string;
          id?: string;
          payload?: Json;
          telegram_user_id?: number | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      entry_sessions: {
        Row: {
          clarifying_answers: Json;
          created_at: string;
          id: string;
          initial_message: string;
          last_question_key: string | null;
          last_question_text: string | null;
          stage: string;
          telegram_user_id: number;
          turn_count: number;
          updated_at: string;
        };
        Insert: {
          clarifying_answers?: Json;
          created_at?: string;
          id?: string;
          initial_message: string;
          last_question_key?: string | null;
          last_question_text?: string | null;
          stage?: string;
          telegram_user_id: number;
          turn_count?: number;
          updated_at?: string;
        };
        Update: {
          clarifying_answers?: Json;
          created_at?: string;
          id?: string;
          initial_message?: string;
          last_question_key?: string | null;
          last_question_text?: string | null;
          stage?: string;
          telegram_user_id?: number;
          turn_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      result_snapshots: {
        Row: {
          company_id: string;
          created_at: string;
          diagnosis_session_id: string;
          dimension_scores: Json;
          id: string;
          overall_score: number | null;
          recommended_tools: Json;
          strongest_zones: Json;
          summary: Json;
          user_id: string;
          weakest_zones: Json;
          workspace_id: string | null;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          diagnosis_session_id: string;
          dimension_scores: Json;
          id?: string;
          overall_score?: number | null;
          recommended_tools: Json;
          strongest_zones: Json;
          summary: Json;
          user_id: string;
          weakest_zones: Json;
          workspace_id?: string | null;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          diagnosis_session_id?: string;
          dimension_scores?: Json;
          id?: string;
          overall_score?: number | null;
          recommended_tools?: Json;
          strongest_zones?: Json;
          summary?: Json;
          user_id?: string;
          weakest_zones?: Json;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "result_snapshots_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "result_snapshots_diagnosis_session_id_fkey";
            columns: ["diagnosis_session_id"];
            isOneToOne: true;
            referencedRelation: "diagnosis_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "result_snapshots_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "result_snapshots_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      tool_categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          position: number;
          slug: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          position?: number;
          slug: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          position?: number;
          slug?: string;
        };
        Relationships: [];
      };
      symptom_tool_map: {
        Row: {
          id: string;
          priority: number;
          symptom_id: string;
          tool_id: string;
        };
        Insert: {
          id?: string;
          priority?: number;
          symptom_id: string;
          tool_id: string;
        };
        Update: {
          id?: string;
          priority?: number;
          symptom_id?: string;
          tool_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "symptom_tool_map_symptom_id_fkey";
            columns: ["symptom_id"];
            isOneToOne: false;
            referencedRelation: "symptoms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "symptom_tool_map_tool_id_fkey";
            columns: ["tool_id"];
            isOneToOne: false;
            referencedRelation: "tools";
            referencedColumns: ["id"];
          },
        ];
      };
      symptoms: {
        Row: {
          id: string;
          reason: string | null;
          section: string;
          slug: string;
          title: string;
        };
        Insert: {
          id?: string;
          reason?: string | null;
          section: string;
          slug: string;
          title: string;
        };
        Update: {
          id?: string;
          reason?: string | null;
          section?: string;
          slug?: string;
          title?: string;
        };
        Relationships: [];
      };
      tools: {
        Row: {
          category_id: string;
          content: Json;
          created_at: string;
          estimated_minutes: number | null;
          format: string;
          id: string;
          is_featured: boolean;
          problem: string | null;
          slug: string;
          stage: string | null;
          summary: string;
          title: string;
        };
        Insert: {
          category_id: string;
          content?: Json;
          created_at?: string;
          estimated_minutes?: number | null;
          format: string;
          id?: string;
          is_featured?: boolean;
          problem?: string | null;
          slug: string;
          stage?: string | null;
          summary: string;
          title: string;
        };
        Update: {
          category_id?: string;
          content?: Json;
          created_at?: string;
          estimated_minutes?: number | null;
          format?: string;
          id?: string;
          is_featured?: boolean;
          problem?: string | null;
          slug?: string;
          stage?: string | null;
          summary?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tools_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "tool_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          first_name: string;
          id: string;
          language_code: string | null;
          last_name: string | null;
          photo_url: string | null;
          telegram_user_id: number;
          telegram_username: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          first_name: string;
          id?: string;
          language_code?: string | null;
          last_name?: string | null;
          photo_url?: string | null;
          telegram_user_id: number;
          telegram_username?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          first_name?: string;
          id?: string;
          language_code?: string | null;
          last_name?: string | null;
          photo_url?: string | null;
          telegram_user_id?: number;
          telegram_username?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          created_at: string;
          id: string;
          role: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          active_company_id: string | null;
          active_diagnosis_session_id: string | null;
          created_at: string;
          id: string;
          last_completed_diagnosis_session_id: string | null;
          last_visited_route: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active_company_id?: string | null;
          active_diagnosis_session_id?: string | null;
          created_at?: string;
          id?: string;
          last_completed_diagnosis_session_id?: string | null;
          last_visited_route?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active_company_id?: string | null;
          active_diagnosis_session_id?: string | null;
          created_at?: string;
          id?: string;
          last_completed_diagnosis_session_id?: string | null;
          last_visited_route?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_active_company_id_fkey";
            columns: ["active_company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspaces_active_diagnosis_session_id_fkey";
            columns: ["active_diagnosis_session_id"];
            isOneToOne: false;
            referencedRelation: "diagnosis_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspaces_last_completed_diagnosis_session_id_fkey";
            columns: ["last_completed_diagnosis_session_id"];
            isOneToOne: false;
            referencedRelation: "diagnosis_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspaces_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
