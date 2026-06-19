// Hand-written to match the M0 migrations (supabase/migrations/0001_*.sql, 0002_*.sql).
// Once a live Supabase project exists, regenerate with:
//   pnpm dlx supabase gen types typescript --project-id <id> > packages/shared-types/src/database.ts
// and re-add the hand-maintained sections (or migrate them into later numbered migrations).
//
// Every table needs a `Relationships` array (even if empty) and the schema needs
// `Views`/`Functions` keys — @supabase/postgrest-js's GenericTable/GenericSchema
// constraints require this shape or type inference silently degrades to `never`.

export type AccountType = "customer" | "staff";
export type BusinessAccountRole = "owner" | "manager" | "operator";
export type BusinessAccountMemberStatus = "active" | "invited" | "removed";
export type StaffDepartment = "sales" | "parts" | "service" | "office" | "manager";
export type EquipmentCategory = "tractor" | "mower" | "utility_vehicle" | "attachment" | "other";
export type EquipmentStatus = "active" | "sold" | "retired";
export type EquipmentDocType = "purchase_agreement" | "financing" | "insurance" | "operators_manual" | "other";
export type HourReadingSource = "customer_entered" | "service_visit" | "jdlink_sync";
export type MaintenanceIntervalType = "hours" | "calendar" | "both";
export type MaintenanceTaskStatus = "upcoming" | "due" | "overdue" | "completed" | "dismissed";
export type NotificationCategory =
  | "maintenance_due"
  | "warranty_expiring"
  | "powergard_expiring"
  | "service_status"
  | "parts_status"
  | "message"
  | "promo"
  | "recall";
export type NotificationChannel = "push" | "sms" | "email";
export type DeviceType = "ios" | "android" | "web";

export interface NotificationPrefs {
  push_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
  marketing_sms_opt_in: boolean;
  marketing_email_opt_in: boolean;
}

export interface DealershipHours {
  monday?: { open: string; close: string } | null;
  tuesday?: { open: string; close: string } | null;
  wednesday?: { open: string; close: string } | null;
  thursday?: { open: string; close: string } | null;
  friday?: { open: string; close: string } | null;
  saturday?: { open: string; close: string } | null;
  sunday?: { open: string; close: string } | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          account_type: AccountType;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          notification_prefs: NotificationPrefs;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          account_type?: AccountType;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          notification_prefs?: NotificationPrefs;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      business_accounts: {
        Row: {
          id: string;
          name: string;
          primary_location_id: string | null;
          tax_exempt_cert_url: string | null;
          tax_exempt_status: string | null;
          jd_financial_account_ref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          primary_location_id?: string | null;
          tax_exempt_cert_url?: string | null;
          tax_exempt_status?: string | null;
          jd_financial_account_ref?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["business_accounts"]["Insert"]>;
        Relationships: [];
      };
      business_account_members: {
        Row: {
          id: string;
          business_account_id: string;
          profile_id: string;
          role: BusinessAccountRole;
          invited_by: string | null;
          status: BusinessAccountMemberStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_account_id: string;
          profile_id: string;
          role: BusinessAccountRole;
          invited_by?: string | null;
          status?: BusinessAccountMemberStatus;
        };
        Update: Partial<Database["public"]["Tables"]["business_account_members"]["Insert"]>;
        Relationships: [];
      };
      staff_roles: {
        Row: {
          id: string;
          profile_id: string;
          department: StaffDepartment;
          dealership_location_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          department: StaffDepartment;
          dealership_location_id?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["staff_roles"]["Insert"]>;
        Relationships: [];
      };
      dealership_locations: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          phone: string | null;
          after_hours_phone: string | null;
          latitude: number | null;
          longitude: number | null;
          hours: DealershipHours | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          phone?: string | null;
          after_hours_phone?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          hours?: DealershipHours | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["dealership_locations"]["Insert"]>;
        Relationships: [];
      };
      equipment: {
        Row: {
          id: string;
          business_account_id: string;
          added_by_profile_id: string | null;
          make: string;
          model: string;
          model_year: number | null;
          serial_number: string | null;
          category: EquipmentCategory;
          nickname: string | null;
          purchase_date: string | null;
          purchase_dealership_location_id: string | null;
          current_hours: number | null;
          primary_photo_url: string | null;
          warranty_expires_at: string | null;
          powergard_expires_at: string | null;
          powergard_plan_name: string | null;
          status: EquipmentStatus;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          business_account_id: string;
          added_by_profile_id?: string | null;
          make?: string;
          model: string;
          model_year?: number | null;
          serial_number?: string | null;
          category?: EquipmentCategory;
          nickname?: string | null;
          purchase_date?: string | null;
          purchase_dealership_location_id?: string | null;
          current_hours?: number | null;
          primary_photo_url?: string | null;
          warranty_expires_at?: string | null;
          powergard_expires_at?: string | null;
          powergard_plan_name?: string | null;
          status?: EquipmentStatus;
        };
        Update: Partial<Database["public"]["Tables"]["equipment"]["Insert"]>;
        Relationships: [];
      };
      equipment_photos: {
        Row: {
          id: string;
          equipment_id: string;
          storage_path: string;
          caption: string | null;
          uploaded_by_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          equipment_id: string;
          storage_path: string;
          caption?: string | null;
          uploaded_by_profile_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["equipment_photos"]["Insert"]>;
        Relationships: [];
      };
      equipment_documents: {
        Row: {
          id: string;
          equipment_id: string;
          doc_type: EquipmentDocType;
          storage_path: string;
          file_name: string;
          uploaded_by_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          equipment_id: string;
          doc_type: EquipmentDocType;
          storage_path: string;
          file_name: string;
          uploaded_by_profile_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["equipment_documents"]["Insert"]>;
        Relationships: [];
      };
      equipment_hour_readings: {
        Row: {
          id: string;
          equipment_id: string;
          hours: number;
          reading_source: HourReadingSource;
          recorded_by_profile_id: string | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          equipment_id: string;
          hours: number;
          reading_source?: HourReadingSource;
          recorded_by_profile_id?: string | null;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["equipment_hour_readings"]["Insert"]>;
        Relationships: [];
      };
      equipment_attachments: {
        Row: {
          id: string;
          equipment_id: string;
          attachment_equipment_id: string | null;
          description: string | null;
        };
        Insert: {
          id?: string;
          equipment_id: string;
          attachment_equipment_id?: string | null;
          description?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["equipment_attachments"]["Insert"]>;
        Relationships: [];
      };
      maintenance_schedule_templates: {
        Row: {
          id: string;
          make: string;
          model_pattern: string;
          task_name: string;
          interval_hours: number | null;
          interval_months: number | null;
          interval_type: MaintenanceIntervalType;
          category: string | null;
          parts_needed: { description: string; part_number?: string }[] | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          make?: string;
          model_pattern: string;
          task_name: string;
          interval_hours?: number | null;
          interval_months?: number | null;
          interval_type: MaintenanceIntervalType;
          category?: string | null;
          parts_needed?: { description: string; part_number?: string }[] | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["maintenance_schedule_templates"]["Insert"]>;
        Relationships: [];
      };
      maintenance_tasks: {
        Row: {
          id: string;
          equipment_id: string;
          template_id: string | null;
          task_name: string;
          due_at_hours: number | null;
          due_at_date: string | null;
          status: MaintenanceTaskStatus;
          completed_at: string | null;
          completed_service_request_id: string | null;
          reminder_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          equipment_id: string;
          template_id?: string | null;
          task_name: string;
          due_at_hours?: number | null;
          due_at_date?: string | null;
          status?: MaintenanceTaskStatus;
          completed_at?: string | null;
          completed_service_request_id?: string | null;
          reminder_sent_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["maintenance_tasks"]["Insert"]>;
        Relationships: [];
      };
      storage_zones: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          dealership_location_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          dealership_location_id?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["storage_zones"]["Insert"]>;
        Relationships: [];
      };
      storage_zone_zip_codes: {
        Row: {
          id: string;
          zone_id: string;
          zip: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          zip: string;
        };
        Update: Partial<Database["public"]["Tables"]["storage_zone_zip_codes"]["Insert"]>;
        Relationships: [];
      };
      storage_season_windows: {
        Row: {
          id: string;
          zone_id: string;
          season_label: string;
          dropoff_window_start: string;
          dropoff_window_end: string;
          pickup_window_start: string;
          pickup_window_end: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          season_label: string;
          dropoff_window_start: string;
          dropoff_window_end: string;
          pickup_window_start: string;
          pickup_window_end: string;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["storage_season_windows"]["Insert"]>;
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          profile_id: string;
          expo_push_token: string;
          device_type: DeviceType;
          is_active: boolean;
          last_used_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          expo_push_token: string;
          device_type: DeviceType;
          is_active?: boolean;
          last_used_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_tokens"]["Insert"]>;
        Relationships: [];
      };
      notification_rules: {
        Row: {
          id: string;
          business_account_id: string | null;
          category: NotificationCategory;
          channel: NotificationChannel;
          is_enabled: boolean;
          lead_time_days: number | null;
          created_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_account_id?: string | null;
          category: NotificationCategory;
          channel: NotificationChannel;
          is_enabled?: boolean;
          lead_time_days?: number | null;
          created_by_profile_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["notification_rules"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_manager: { Args: Record<string, never>; Returns: boolean };
      business_account_role: { Args: { target_business_account_id: string }; Returns: string | null };
      zone_for_zip: { Args: { target_zip: string }; Returns: string | null };
      generate_maintenance_tasks_for_equipment: { Args: { target_equipment_id: string }; Returns: undefined };
      notification_rule_enabled: {
        Args: { target_business_account_id: string; target_category: string; target_channel: string };
        Returns: boolean;
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type BusinessAccount = Database["public"]["Tables"]["business_accounts"]["Row"];
export type BusinessAccountMember = Database["public"]["Tables"]["business_account_members"]["Row"];
export type StaffRole = Database["public"]["Tables"]["staff_roles"]["Row"];
export type DealershipLocation = Database["public"]["Tables"]["dealership_locations"]["Row"];
export type StorageZone = Database["public"]["Tables"]["storage_zones"]["Row"];
export type StorageZoneZipCode = Database["public"]["Tables"]["storage_zone_zip_codes"]["Row"];
export type StorageSeasonWindow = Database["public"]["Tables"]["storage_season_windows"]["Row"];
export type Equipment = Database["public"]["Tables"]["equipment"]["Row"];
export type EquipmentPhoto = Database["public"]["Tables"]["equipment_photos"]["Row"];
export type EquipmentDocument = Database["public"]["Tables"]["equipment_documents"]["Row"];
export type EquipmentHourReading = Database["public"]["Tables"]["equipment_hour_readings"]["Row"];
export type EquipmentAttachment = Database["public"]["Tables"]["equipment_attachments"]["Row"];
export type MaintenanceScheduleTemplate = Database["public"]["Tables"]["maintenance_schedule_templates"]["Row"];
export type MaintenanceTask = Database["public"]["Tables"]["maintenance_tasks"]["Row"];
export type PushToken = Database["public"]["Tables"]["push_tokens"]["Row"];
export type NotificationRule = Database["public"]["Tables"]["notification_rules"]["Row"];
