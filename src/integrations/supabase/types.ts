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
      approval_requests: {
        Row: {
          branch_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          entity_id: string | null
          entity_label: string | null
          entity_table: string
          id: string
          payload: Json
          reason: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          type: Database["public"]["Enums"]["approval_type"]
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_table: string
          id?: string
          payload?: Json
          reason?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          type: Database["public"]["Enums"]["approval_type"]
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_table?: string
          id?: string
          payload?: Json
          reason?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          type?: Database["public"]["Enums"]["approval_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          branch_id: string | null
          created_at: string
          detail: Json
          entity_id: string | null
          entity_table: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          branch_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_table?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          branch_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_table?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_runs: {
        Row: {
          file_path: string | null
          finished_at: string | null
          id: string
          message: string | null
          row_counts: Json
          size_bytes: number | null
          started_at: string
          status: string
        }
        Insert: {
          file_path?: string | null
          finished_at?: string | null
          id?: string
          message?: string | null
          row_counts?: Json
          size_bytes?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          file_path?: string | null
          finished_at?: string | null
          id?: string
          message?: string | null
          row_counts?: Json
          size_bytes?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          active: boolean
          address: string | null
          code: string
          created_at: string
          district: string | null
          id: string
          is_hq: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          code: string
          created_at?: string
          district?: string | null
          id?: string
          is_hq?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          code?: string
          created_at?: string
          district?: string | null
          id?: string
          is_hq?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cash_entries: {
        Row: {
          branch_id: string
          change_amount: number
          contract_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          direction: Database["public"]["Enums"]["cash_direction"]
          doc_no: string
          entry_date: string
          id: string
          legacy_code: string | null
          method: string
          note: string | null
          party_name: string
          payment_id: string | null
          total_amount: number
          updated_at: string
          voided: boolean
        }
        Insert: {
          branch_id: string
          change_amount?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          direction: Database["public"]["Enums"]["cash_direction"]
          doc_no: string
          entry_date?: string
          id?: string
          legacy_code?: string | null
          method?: string
          note?: string | null
          party_name?: string
          payment_id?: string | null
          total_amount?: number
          updated_at?: string
          voided?: boolean
        }
        Update: {
          branch_id?: string
          change_amount?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          direction?: Database["public"]["Enums"]["cash_direction"]
          doc_no?: string
          entry_date?: string
          id?: string
          legacy_code?: string | null
          method?: string
          note?: string | null
          party_name?: string
          payment_id?: string | null
          total_amount?: number
          updated_at?: string
          voided?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cash_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_entry_lines: {
        Row: {
          amount: number
          branch_id: string
          category: Database["public"]["Enums"]["cash_category"]
          created_at: string
          direction: Database["public"]["Enums"]["cash_direction"]
          entry_id: string
          id: string
          note: string | null
        }
        Insert: {
          amount?: number
          branch_id: string
          category: Database["public"]["Enums"]["cash_category"]
          created_at?: string
          direction: Database["public"]["Enums"]["cash_direction"]
          entry_id: string
          id?: string
          note?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          category?: Database["public"]["Enums"]["cash_category"]
          created_at?: string
          direction?: Database["public"]["Enums"]["cash_direction"]
          entry_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_entry_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entry_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_activities: {
        Row: {
          acted_at: string
          branch_id: string
          channel: string
          contract_id: string
          created_at: string
          created_by: string | null
          detail: string | null
          id: string
          next_action_date: string | null
          promise_date: string | null
          result: string | null
        }
        Insert: {
          acted_at?: string
          branch_id: string
          channel?: string
          contract_id: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          next_action_date?: string | null
          promise_date?: string | null
          result?: string | null
        }
        Update: {
          acted_at?: string
          branch_id?: string
          channel?: string
          contract_id?: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          next_action_date?: string | null
          promise_date?: string | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_activities_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_activities_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          application_id: string | null
          branch_id: string
          code: string
          created_at: string
          created_by: string | null
          customer_id: string
          end_date: string | null
          fee_amount: number
          first_due_date: string | null
          first_payment_at: string | null
          id: string
          installment_amount: number
          interest_rate: number
          note: string | null
          outstanding: number
          principal: number
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          term_months: number
          total_payable: number
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          application_id?: string | null
          branch_id: string
          code: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          end_date?: string | null
          fee_amount?: number
          first_due_date?: string | null
          first_payment_at?: string | null
          id?: string
          installment_amount?: number
          interest_rate?: number
          note?: string | null
          outstanding?: number
          principal?: number
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          term_months?: number
          total_payable?: number
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          application_id?: string | null
          branch_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          end_date?: string | null
          fee_amount?: number
          first_due_date?: string | null
          first_payment_at?: string | null
          id?: string
          installment_amount?: number
          interest_rate?: number
          note?: string | null
          outstanding?: number
          principal?: number
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          term_months?: number
          total_payable?: number
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          birth_date: string | null
          branch_id: string
          code: string
          created_at: string
          created_by: string | null
          district: string | null
          document_no: string | null
          email: string | null
          emergency_name: string | null
          emergency_phone: string | null
          emergency_relation: string | null
          full_name: string
          id: string
          line_id: string | null
          monthly_income: number | null
          national_id: string | null
          note: string | null
          occupation: string | null
          phone: string | null
          phone2: string | null
          postcode: string | null
          province: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          branch_id: string
          code: string
          created_at?: string
          created_by?: string | null
          district?: string | null
          document_no?: string | null
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relation?: string | null
          full_name: string
          id?: string
          line_id?: string | null
          monthly_income?: number | null
          national_id?: string | null
          note?: string | null
          occupation?: string | null
          phone?: string | null
          phone2?: string | null
          postcode?: string | null
          province?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          branch_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          district?: string | null
          document_no?: string | null
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relation?: string | null
          full_name?: string
          id?: string
          line_id?: string | null
          monthly_income?: number | null
          national_id?: string | null
          note?: string | null
          occupation?: string | null
          phone?: string | null
          phone2?: string | null
          postcode?: string | null
          province?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      disbursements: {
        Row: {
          amount: number
          branch_id: string
          contract_id: string
          created_at: string
          id: string
          method: string
          note: string | null
          paid_at: string
          paid_by: string | null
          reference: string | null
        }
        Insert: {
          amount?: number
          branch_id: string
          contract_id: string
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          paid_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          contract_id?: string
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          paid_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disbursements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_counters: {
        Row: {
          branch_id: string
          doc_type: string
          last_no: number
          period: string
        }
        Insert: {
          branch_id: string
          doc_type: string
          last_no?: number
          period: string
        }
        Update: {
          branch_id?: string
          doc_type?: string
          last_no?: number
          period?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          branch_id: string
          created_at: string
          doc_type: string | null
          entity_id: string
          entity_table: string
          file_name: string | null
          file_path: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          doc_type?: string | null
          entity_id: string
          entity_table: string
          file_name?: string | null
          file_path: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          doc_type?: string | null
          entity_id?: string
          entity_table?: string
          file_name?: string | null
          file_path?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          branch_id: string
          contract_id: string
          created_at: string
          due_date: string
          id: string
          interest_amount: number
          paid_amount: number
          paid_date: string | null
          penalty_amount: number
          principal_amount: number
          seq: number
          status: Database["public"]["Enums"]["installment_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          interest_amount?: number
          paid_amount?: number
          paid_date?: string | null
          penalty_amount?: number
          principal_amount?: number
          seq: number
          status?: Database["public"]["Enums"]["installment_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          interest_amount?: number
          paid_amount?: number
          paid_date?: string | null
          penalty_amount?: number
          principal_amount?: number
          seq?: number
          status?: Database["public"]["Enums"]["installment_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_secrets: {
        Row: {
          category: string
          created_at: string
          key: string
          label: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          category?: string
          created_at?: string
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          category?: string
          created_at?: string
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      legacy_customers: {
        Row: {
          address: string | null
          branch_id: string
          car_brand: string | null
          car_type: string | null
          color: string | null
          contract_date: string | null
          created_at: string
          full_name: string | null
          guarantor_name: string | null
          guarantor_tel: string | null
          hire_price: number
          id: string
          import_run_id: string | null
          installment_amount: number
          legacy_code: string
          loan_amount: number
          migrated_contract_id: string | null
          migrated_customer_id: string | null
          national_id: string | null
          note: string | null
          old_code: string | null
          outstanding: number
          plate_no: string | null
          status: string
          tax_due_date: string | null
          tel: string | null
          term_months: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_id: string
          car_brand?: string | null
          car_type?: string | null
          color?: string | null
          contract_date?: string | null
          created_at?: string
          full_name?: string | null
          guarantor_name?: string | null
          guarantor_tel?: string | null
          hire_price?: number
          id?: string
          import_run_id?: string | null
          installment_amount?: number
          legacy_code: string
          loan_amount?: number
          migrated_contract_id?: string | null
          migrated_customer_id?: string | null
          national_id?: string | null
          note?: string | null
          old_code?: string | null
          outstanding?: number
          plate_no?: string | null
          status?: string
          tax_due_date?: string | null
          tel?: string | null
          term_months?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_id?: string
          car_brand?: string | null
          car_type?: string | null
          color?: string | null
          contract_date?: string | null
          created_at?: string
          full_name?: string | null
          guarantor_name?: string | null
          guarantor_tel?: string | null
          hire_price?: number
          id?: string
          import_run_id?: string | null
          installment_amount?: number
          legacy_code?: string
          loan_amount?: number
          migrated_contract_id?: string | null
          migrated_customer_id?: string | null
          national_id?: string | null
          note?: string | null
          old_code?: string | null
          outstanding?: number
          plate_no?: string | null
          status?: string
          tax_due_date?: string | null
          tel?: string | null
          term_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_customers_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "legacy_import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_customers_migrated_contract_id_fkey"
            columns: ["migrated_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_customers_migrated_customer_id_fkey"
            columns: ["migrated_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_import_runs: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          dataset: string
          error_count: number
          id: string
          note: string | null
          row_count: number
          source_file: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          dataset: string
          error_count?: number
          id?: string
          note?: string | null
          row_count?: number
          source_file?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          dataset?: string
          error_count?: number
          id?: string
          note?: string | null
          row_count?: number
          source_file?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_import_runs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_import_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_receipts: {
        Row: {
          bill_no: string
          branch_id: string
          change_amount: number
          created_at: string
          follow_up_amount: number
          full_name: string | null
          id: string
          import_run_id: string | null
          insurance_amount: number
          interest_amount: number
          legacy_code: string
          note: string | null
          paid_on: string | null
          paid_on_raw: string | null
          penalty_amount: number
          principal_amount: number
          registration_amount: number
          total_amount: number
        }
        Insert: {
          bill_no: string
          branch_id: string
          change_amount?: number
          created_at?: string
          follow_up_amount?: number
          full_name?: string | null
          id?: string
          import_run_id?: string | null
          insurance_amount?: number
          interest_amount?: number
          legacy_code: string
          note?: string | null
          paid_on?: string | null
          paid_on_raw?: string | null
          penalty_amount?: number
          principal_amount?: number
          registration_amount?: number
          total_amount?: number
        }
        Update: {
          bill_no?: string
          branch_id?: string
          change_amount?: number
          created_at?: string
          follow_up_amount?: number
          full_name?: string | null
          id?: string
          import_run_id?: string | null
          insurance_amount?: number
          interest_amount?: number
          legacy_code?: string
          note?: string | null
          paid_on?: string | null
          paid_on_raw?: string | null
          penalty_amount?: number
          principal_amount?: number
          registration_amount?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "legacy_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_receipts_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "legacy_import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_applications: {
        Row: {
          approved_amount: number | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          code: string
          created_at: string
          created_by: string | null
          customer_id: string
          document_no: string | null
          fee_amount: number
          id: string
          interest_rate: number
          note: string | null
          purpose: string | null
          reject_reason: string | null
          requested_amount: number
          status: Database["public"]["Enums"]["application_status"]
          term_months: number
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          code: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          document_no?: string | null
          fee_amount?: number
          id?: string
          interest_rate?: number
          note?: string | null
          purpose?: string | null
          reject_reason?: string | null
          requested_amount?: number
          status?: Database["public"]["Enums"]["application_status"]
          term_months?: number
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          document_no?: string | null
          fee_amount?: number
          id?: string
          interest_rate?: number
          note?: string | null
          purpose?: string | null
          reject_reason?: string | null
          requested_amount?: number
          status?: Database["public"]["Enums"]["application_status"]
          term_months?: number
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_guarantors: {
        Row: {
          application_id: string
          branch_id: string
          created_at: string
          customer_id: string | null
          full_name: string
          id: string
          line_id: string | null
          national_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          application_id: string
          branch_id: string
          created_at?: string
          customer_id?: string | null
          full_name: string
          id?: string
          line_id?: string | null
          national_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          branch_id?: string
          created_at?: string
          customer_id?: string | null
          full_name?: string
          id?: string
          line_id?: string | null
          national_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_guarantors_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_guarantors_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_guarantors_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          audience: string
          branch_id: string | null
          created_at: string
          delivered_at: string | null
          entity_id: string | null
          entity_table: string | null
          event_type: string
          id: string
          message: string | null
          payload: Json
          read_at: string | null
          status: Database["public"]["Enums"]["notify_status"]
          target_user_id: string | null
          title: string
        }
        Insert: {
          audience?: string
          branch_id?: string | null
          created_at?: string
          delivered_at?: string | null
          entity_id?: string | null
          entity_table?: string | null
          event_type: string
          id?: string
          message?: string | null
          payload?: Json
          read_at?: string | null
          status?: Database["public"]["Enums"]["notify_status"]
          target_user_id?: string | null
          title: string
        }
        Update: {
          audience?: string
          branch_id?: string | null
          created_at?: string
          delivered_at?: string | null
          entity_id?: string | null
          entity_table?: string | null
          event_type?: string
          id?: string
          message?: string | null
          payload?: Json
          read_at?: string | null
          status?: Database["public"]["Enums"]["notify_status"]
          target_user_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          allocation_snapshot: Json
          amount: number
          branch_id: string
          contract_id: string
          created_at: string
          id: string
          installment_id: string | null
          interest_part: number
          method: string
          note: string | null
          paid_at: string
          penalty_part: number
          principal_part: number
          receipt_no: string
          received_by: string | null
          reference: string | null
          void_approval_id: string | null
          void_reason: string | null
          voided: boolean
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          allocation_snapshot?: Json
          amount?: number
          branch_id: string
          contract_id: string
          created_at?: string
          id?: string
          installment_id?: string | null
          interest_part?: number
          method?: string
          note?: string | null
          paid_at?: string
          penalty_part?: number
          principal_part?: number
          receipt_no: string
          received_by?: string | null
          reference?: string | null
          void_approval_id?: string | null
          void_reason?: string | null
          voided?: boolean
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          allocation_snapshot?: Json
          amount?: number
          branch_id?: string
          contract_id?: string
          created_at?: string
          id?: string
          installment_id?: string | null
          interest_part?: number
          method?: string
          note?: string | null
          paid_at?: string
          penalty_part?: number
          principal_part?: number
          receipt_no?: string
          received_by?: string | null
          reference?: string | null
          void_approval_id?: string | null
          void_reason?: string | null
          voided?: boolean
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_void_approval_id_fkey"
            columns: ["void_approval_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          branch_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          line_user_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          line_user_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          line_user_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      status_incidents: {
        Row: {
          created_at: string
          guid: string
          id: string
          impact_summary: string | null
          incident_state: string
          link: string | null
          notified_browser: boolean
          notified_line: boolean
          published_at: string
          raw_content: string | null
          resolved_at: string | null
          severity: string
          situation: string | null
          source: string
          started_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          guid: string
          id?: string
          impact_summary?: string | null
          incident_state?: string
          link?: string | null
          notified_browser?: boolean
          notified_line?: boolean
          published_at?: string
          raw_content?: string | null
          resolved_at?: string | null
          severity?: string
          situation?: string | null
          source?: string
          started_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          guid?: string
          id?: string
          impact_summary?: string | null
          incident_state?: string
          link?: string | null
          notified_browser?: boolean
          notified_line?: boolean
          published_at?: string
          raw_content?: string | null
          resolved_at?: string | null
          severity?: string
          situation?: string | null
          source?: string
          started_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: number
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          id?: number
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          description?: string | null
          id?: number
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          appraised_value: number
          book_status: Database["public"]["Enums"]["vehicle_book_status"]
          branch_id: string
          brand: string | null
          chassis_no: string | null
          color: string | null
          created_at: string
          customer_id: string | null
          engine_no: string | null
          id: string
          mileage: number | null
          model: string | null
          note: string | null
          plate_no: string | null
          plate_province: string | null
          registration_due_date: string | null
          updated_at: string
          vehicle_type: string
          year: number | null
        }
        Insert: {
          appraised_value?: number
          book_status?: Database["public"]["Enums"]["vehicle_book_status"]
          branch_id: string
          brand?: string | null
          chassis_no?: string | null
          color?: string | null
          created_at?: string
          customer_id?: string | null
          engine_no?: string | null
          id?: string
          mileage?: number | null
          model?: string | null
          note?: string | null
          plate_no?: string | null
          plate_province?: string | null
          registration_due_date?: string | null
          updated_at?: string
          vehicle_type?: string
          year?: number | null
        }
        Update: {
          appraised_value?: number
          book_status?: Database["public"]["Enums"]["vehicle_book_status"]
          branch_id?: string
          brand?: string | null
          chassis_no?: string | null
          color?: string | null
          created_at?: string
          customer_id?: string | null
          engine_no?: string | null
          id?: string
          mileage?: number | null
          model?: string | null
          note?: string | null
          plate_no?: string | null
          plate_province?: string | null
          registration_due_date?: string | null
          updated_at?: string
          vehicle_type?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_branch: { Args: { _branch: string }; Returns: boolean }
      check_customer_identity_duplicate: {
        Args: {
          _exclude_customer_id?: string
          _national_id: string
          _phone: string
        }
        Returns: {
          conflict_field: string
          customer_code: string
          customer_id: string
          customer_name: string
        }[]
      }
      delete_integration_secret: { Args: { _key: string }; Returns: boolean }
      execute_approval_request: {
        Args: {
          _approval_id: string
          _approve: boolean
          _decision_note?: string
        }
        Returns: Json
      }
      execute_approval_request_phase_a_contract_cancel: {
        Args: {
          _approval_id: string
          _approve: boolean
          _decision_note?: string
        }
        Returns: Json
      }
      global_customer_history_search: {
        Args: { _q: string }
        Returns: {
          branch_code: string
          branch_name: string
          event_date: string
          full_name: string
          history_type: string
          line_id: string
          national_id: string
          person_id: string
          phone: string
          reference_no: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_current_user_active: { Args: never; Returns: boolean }
      is_hq: { Args: { _user_id: string }; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      list_integration_secrets: {
        Args: never
        Returns: {
          category: string
          key: string
          label: string
          masked: string
          updated_at: string
        }[]
      }
      mask_secret: { Args: { _v: string }; Returns: string }
      my_branch: { Args: { _user_id: string }; Returns: string }
      next_doc_no: {
        Args: { _branch: string; _doc_type: string }
        Returns: string
      }
      perform_contract_cancel: { Args: { _approval_id: string }; Returns: Json }
      perform_payment_void: { Args: { _approval_id: string }; Returns: Json }
      set_integration_secret: {
        Args: {
          _category: string
          _key: string
          _label: string
          _value: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "approver" | "staff" | "viewer"
      application_status:
        | "draft"
        | "submitted"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "cancelled"
        | "contracted"
      approval_status: "pending" | "approved" | "rejected" | "cancelled"
      approval_type:
        | "delete_record"
        | "loan_approval"
        | "contract_cancel"
        | "restructure"
        | "payment_void"
        | "other"
      cash_category:
        | "principal"
        | "interest"
        | "penalty"
        | "insurance"
        | "registration"
        | "follow_up"
        | "salary"
        | "office"
        | "loan_repay"
        | "inter_branch"
        | "other"
      cash_direction: "income" | "expense"
      contract_status:
        | "active"
        | "closed"
        | "overdue"
        | "defaulted"
        | "cancelled"
      customer_status: "active" | "inactive" | "blacklist"
      installment_status: "unpaid" | "partial" | "paid" | "overdue" | "waived"
      notify_status: "queued" | "sent" | "failed"
      vehicle_book_status: "pending" | "received" | "returned" | "seized"
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
      app_role: ["admin", "manager", "approver", "staff", "viewer"],
      application_status: [
        "draft",
        "submitted",
        "pending_approval",
        "approved",
        "rejected",
        "cancelled",
        "contracted",
      ],
      approval_status: ["pending", "approved", "rejected", "cancelled"],
      approval_type: [
        "delete_record",
        "loan_approval",
        "contract_cancel",
        "restructure",
        "payment_void",
        "other",
      ],
      cash_category: [
        "principal",
        "interest",
        "penalty",
        "insurance",
        "registration",
        "follow_up",
        "salary",
        "office",
        "loan_repay",
        "inter_branch",
        "other",
      ],
      cash_direction: ["income", "expense"],
      contract_status: [
        "active",
        "closed",
        "overdue",
        "defaulted",
        "cancelled",
      ],
      customer_status: ["active", "inactive", "blacklist"],
      installment_status: ["unpaid", "partial", "paid", "overdue", "waived"],
      notify_status: ["queued", "sent", "failed"],
      vehicle_book_status: ["pending", "received", "returned", "seized"],
    },
  },
} as const
