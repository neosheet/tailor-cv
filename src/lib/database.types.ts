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
      cv_items: {
        Row: {
          cv_id: string
          item_id: string
          position: number
        }
        Insert: {
          cv_id: string
          item_id: string
          position?: number
        }
        Update: {
          cv_id?: string
          item_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "cv_items_cv_id_fkey"
            columns: ["cv_id"]
            isOneToOne: false
            referencedRelation: "cvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_lines: {
        Row: {
          cv_id: string
          item_id: string
          line_id: string
          position: number
        }
        Insert: {
          cv_id: string
          item_id: string
          line_id: string
          position?: number
        }
        Update: {
          cv_id?: string
          item_id?: string
          line_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "cv_lines_cv_id_item_id_fkey"
            columns: ["cv_id", "item_id"]
            isOneToOne: false
            referencedRelation: "cv_items"
            referencedColumns: ["cv_id", "item_id"]
          },
          {
            foreignKeyName: "cv_lines_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "inventory_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_sections: {
        Row: {
          cv_id: string
          kind: Database["public"]["Enums"]["item_kind"]
          position: number
        }
        Insert: {
          cv_id: string
          kind: Database["public"]["Enums"]["item_kind"]
          position?: number
        }
        Update: {
          cv_id?: string
          kind?: Database["public"]["Enums"]["item_kind"]
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "cv_sections_cv_id_fkey"
            columns: ["cv_id"]
            isOneToOne: false
            referencedRelation: "cvs"
            referencedColumns: ["id"]
          },
        ]
      }
      cvs: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
