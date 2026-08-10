export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      application_status_history: {
        Row: {
          application_id: string
          changed_at: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          application_id: string
          changed_at?: string
          id?: string
          note?: string | null
          status: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          application_id?: string
          changed_at?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          apply_via: string | null
          created_at: string
          cv_id: string | null
          cv_snapshot: Json | null
          id: string
          note: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["application_status"]
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          vacancy_detail: string | null
        }
        Insert: {
          apply_via?: string | null
          created_at?: string
          cv_id?: string | null
          cv_snapshot?: Json | null
          id?: string
          note?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
          vacancy_detail?: string | null
        }
        Update: {
          apply_via?: string | null
          created_at?: string
          cv_id?: string | null
          cv_snapshot?: Json | null
          id?: string
          note?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          vacancy_detail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_cv_id_fkey"
            columns: ["cv_id"]
            isOneToOne: false
            referencedRelation: "cvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cvs: {
        Row: {
          created_at: string
          favorite: boolean
          id: string
          name: string
          note: string | null
          persona_id: string | null
          persona_settings: Json
          snapshot: Json | null
          tags: string[]
          template_id: string | null
          template_settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorite?: boolean
          id?: string
          name: string
          note?: string | null
          persona_id?: string | null
          persona_settings?: Json
          snapshot?: Json | null
          tags?: string[]
          template_id?: string | null
          template_settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorite?: boolean
          id?: string
          name?: string
          note?: string | null
          persona_id?: string | null
          persona_settings?: Json
          snapshot?: Json | null
          tags?: string[]
          template_id?: string | null
          template_settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cvs_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cvs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category_id: string | null
          created_at: string
          details: Json
          end_date: string | null
          favorite: boolean
          id: string
          kind: Database["public"]["Enums"]["item_kind"]
          note: string | null
          position: number
          start_date: string | null
          subtitle: string | null
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          url: string | null
          user_id: string
          years_experience: number | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          details?: Json
          end_date?: string | null
          favorite?: boolean
          id?: string
          kind: Database["public"]["Enums"]["item_kind"]
          note?: string | null
          position?: number
          start_date?: string | null
          subtitle?: string | null
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
          years_experience?: number | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          details?: Json
          end_date?: string | null
          favorite?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["item_kind"]
          note?: string | null
          position?: number
          start_date?: string | null
          subtitle?: string | null
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_lines: {
        Row: {
          content: string
          created_at: string
          id: string
          item_id: string
          list_kind: Database["public"]["Enums"]["line_kind"]
          note: string | null
          position: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          item_id: string
          list_kind: Database["public"]["Enums"]["line_kind"]
          note?: string | null
          position?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          item_id?: string
          list_kind?: Database["public"]["Enums"]["line_kind"]
          note?: string | null
          position?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_skills: {
        Row: {
          created_at: string
          item_id: string
          position: number
          skill_id: string
          skill_kind: Database["public"]["Enums"]["item_kind"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          item_id: string
          position?: number
          skill_id: string
          skill_kind?: Database["public"]["Enums"]["item_kind"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          item_id?: string
          position?: number
          skill_id?: string
          skill_kind?: Database["public"]["Enums"]["item_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_skills_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_skills_skill_id_skill_kind_fkey"
            columns: ["skill_id", "skill_kind"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "kind"]
          },
        ]
      }
      persona_items: {
        Row: {
          item_id: string
          persona_id: string
          position: number
        }
        Insert: {
          item_id: string
          persona_id: string
          position?: number
        }
        Update: {
          item_id?: string
          persona_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "persona_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_items_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_lines: {
        Row: {
          item_id: string
          line_id: string
          persona_id: string
          position: number
        }
        Insert: {
          item_id: string
          line_id: string
          persona_id: string
          position?: number
        }
        Update: {
          item_id?: string
          line_id?: string
          persona_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "persona_lines_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "inventory_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_lines_persona_id_item_id_fkey"
            columns: ["persona_id", "item_id"]
            isOneToOne: false
            referencedRelation: "persona_items"
            referencedColumns: ["persona_id", "item_id"]
          },
        ]
      }
      persona_sections: {
        Row: {
          kind: Database["public"]["Enums"]["item_kind"]
          persona_id: string
          position: number
        }
        Insert: {
          kind: Database["public"]["Enums"]["item_kind"]
          persona_id: string
          position?: number
        }
        Update: {
          kind?: Database["public"]["Enums"]["item_kind"]
          persona_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "persona_sections_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          created_at: string
          favorite: boolean
          id: string
          name: string
          note: string | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorite?: boolean
          id?: string
          name: string
          note?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorite?: boolean
          id?: string
          name?: string
          note?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      skill_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      application_status:
        | "draft"
        | "applied"
        | "interview_call"
        | "approved"
        | "rejected"
        | "archived"
        | "withdraw"
      item_kind:
        | "name"
        | "headline"
        | "summary"
        | "contact"
        | "location"
        | "social"
        | "work"
        | "volunteer"
        | "education"
        | "award"
        | "certificate"
        | "publication"
        | "skill"
        | "language"
        | "interest"
        | "reference"
        | "project"
      line_kind:
        | "highlights"
        | "responsibilities"
        | "courses"
        | "keywords"
        | "roles"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      application_status: [
        "draft",
        "applied",
        "interview_call",
        "approved",
        "rejected",
        "archived",
        "withdraw",
      ],
      item_kind: [
        "name",
        "headline",
        "summary",
        "contact",
        "location",
        "social",
        "work",
        "volunteer",
        "education",
        "award",
        "certificate",
        "publication",
        "skill",
        "language",
        "interest",
        "reference",
        "project",
      ],
      line_kind: [
        "highlights",
        "responsibilities",
        "courses",
        "keywords",
        "roles",
      ],
    },
  },
} as const
