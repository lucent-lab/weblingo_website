export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      launch_waitlist_signups: {
        Row: {
          id: string;
          email: string;
          site_url: string | null;
          user_agent: string | null;
          referer: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          site_url?: string | null;
          user_agent?: string | null;
          referer?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          site_url?: string | null;
          user_agent?: string | null;
          referer?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          id: string;
          locale: string;
          full_name: string;
          work_email: string;
          domain: string | null;
          locales: string | null;
          message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          locale: string;
          full_name: string;
          work_email: string;
          domain?: string | null;
          locales?: string | null;
          message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          locale?: string;
          full_name?: string;
          work_email?: string;
          domain?: string | null;
          locales?: string | null;
          message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
