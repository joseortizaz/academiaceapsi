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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          activo: boolean | null
          autor_id: string
          contenido: string
          created_at: string
          fecha_expiracion: string | null
          fecha_publicacion: string
          id: string
          programa_id: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean | null
          autor_id: string
          contenido: string
          created_at?: string
          fecha_expiracion?: string | null
          fecha_publicacion?: string
          id?: string
          programa_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean | null
          autor_id?: string
          contenido?: string
          created_at?: string
          fecha_expiracion?: string | null
          fecha_publicacion?: string
          id?: string
          programa_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          created_at: string
          enunciado: string
          id: string
          opciones: Json | null
          orden: number
          puntaje: number
          respuesta_correcta: string | null
          tipo: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          enunciado: string
          id?: string
          opciones?: Json | null
          orden?: number
          puntaje?: number
          respuesta_correcta?: string | null
          tipo?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          enunciado?: string
          id?: string
          opciones?: Json | null
          orden?: number
          puntaje?: number
          respuesta_correcta?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          created_at: string
          created_by: string
          descripcion: string | null
          duracion_minutos: number | null
          fecha_limite: string | null
          id: string
          instrucciones: string | null
          modulo_id: string | null
          peso_porcentaje: number
          programa_id: string
          publicado: boolean
          puntaje_maximo: number
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          descripcion?: string | null
          duracion_minutos?: number | null
          fecha_limite?: string | null
          id?: string
          instrucciones?: string | null
          modulo_id?: string | null
          peso_porcentaje?: number
          programa_id: string
          publicado?: boolean
          puntaje_maximo?: number
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          descripcion?: string | null
          duracion_minutos?: number | null
          fecha_limite?: string | null
          id?: string
          instrucciones?: string | null
          modulo_id?: string | null
          peso_porcentaje?: number
          programa_id?: string
          publicado?: boolean
          puntaje_maximo?: number
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          autor_id: string
          categoria_id: string | null
          contenido: string
          created_at: string
          destacado: boolean | null
          estado: string
          fecha_publicacion: string | null
          id: string
          imagen_url: string | null
          resumen: string | null
          slug: string
          tags: string[] | null
          titulo: string
          updated_at: string
          vistas: number | null
        }
        Insert: {
          autor_id: string
          categoria_id?: string | null
          contenido: string
          created_at?: string
          destacado?: boolean | null
          estado?: string
          fecha_publicacion?: string | null
          id?: string
          imagen_url?: string | null
          resumen?: string | null
          slug: string
          tags?: string[] | null
          titulo: string
          updated_at?: string
          vistas?: number | null
        }
        Update: {
          autor_id?: string
          categoria_id?: string | null
          contenido?: string
          created_at?: string
          destacado?: boolean | null
          estado?: string
          fecha_publicacion?: string | null
          id?: string
          imagen_url?: string | null
          resumen?: string | null
          slug?: string
          tags?: string[] | null
          titulo?: string
          updated_at?: string
          vistas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          descripcion: string | null
          icono: string | null
          id: string
          nombre: string
          orden: number | null
          slug: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre: string
          orden?: number | null
          slug: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre?: string
          orden?: number | null
          slug?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          created_at: string
          enrollment_id: string | null
          estado: string
          fecha_emision: string
          fecha_expiracion: string | null
          id: string
          notas: string | null
          numero_certificado: string
          programa_id: string
          url_pdf: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          enrollment_id?: string | null
          estado?: string
          fecha_emision?: string
          fecha_expiracion?: string | null
          id?: string
          notas?: string | null
          numero_certificado: string
          programa_id: string
          url_pdf?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string | null
          estado?: string
          fecha_emision?: string
          fecha_expiracion?: string | null
          id?: string
          notas?: string | null
          numero_certificado?: string
          programa_id?: string
          url_pdf?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          asunto: string
          created_at: string
          email: string
          id: string
          leido: boolean | null
          mensaje: string
          nombre: string
          respondido: boolean | null
          telefono: string | null
        }
        Insert: {
          asunto: string
          created_at?: string
          email: string
          id?: string
          leido?: boolean | null
          mensaje: string
          nombre: string
          respondido?: boolean | null
          telefono?: string | null
        }
        Update: {
          asunto?: string
          created_at?: string
          email?: string
          id?: string
          leido?: boolean | null
          mensaje?: string
          nombre?: string
          respondido?: boolean | null
          telefono?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          fecha_expiracion: string | null
          id: string
          porcentaje_descuento: number
          updated_at: string
          usos_actuales: number
          usos_maximos: number | null
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          fecha_expiracion?: string | null
          id?: string
          porcentaje_descuento: number
          updated_at?: string
          usos_actuales?: number
          usos_maximos?: number | null
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          fecha_expiracion?: string | null
          id?: string
          porcentaje_descuento?: number
          updated_at?: string
          usos_actuales?: number
          usos_maximos?: number | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          area_profesional: string | null
          documento_identidad: string | null
          email_contacto: string | null
          estado: string
          fecha_completado: string | null
          fecha_inscripcion: string
          fecha_vencimiento: string | null
          id: string
          nombre_completo: string | null
          notas: string | null
          pago_id: string | null
          programa_id: string
          progreso_porcentaje: number
          telefono_contacto: string | null
          user_id: string
        }
        Insert: {
          area_profesional?: string | null
          documento_identidad?: string | null
          email_contacto?: string | null
          estado?: string
          fecha_completado?: string | null
          fecha_inscripcion?: string
          fecha_vencimiento?: string | null
          id?: string
          nombre_completo?: string | null
          notas?: string | null
          pago_id?: string | null
          programa_id: string
          progreso_porcentaje?: number
          telefono_contacto?: string | null
          user_id: string
        }
        Update: {
          area_profesional?: string | null
          documento_identidad?: string | null
          email_contacto?: string | null
          estado?: string
          fecha_completado?: string | null
          fecha_inscripcion?: string
          fecha_vencimiento?: string | null
          id?: string
          nombre_completo?: string | null
          notas?: string | null
          pago_id?: string | null
          programa_id?: string
          progreso_porcentaje?: number
          telefono_contacto?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_slides: {
        Row: {
          activo: boolean
          alt: string | null
          created_at: string
          enlace_url: string | null
          id: string
          imagen_url: string
          orden: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          alt?: string | null
          created_at?: string
          enlace_url?: string | null
          id?: string
          imagen_url: string
          orden?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          alt?: string | null
          created_at?: string
          enlace_url?: string | null
          id?: string
          imagen_url?: string
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
      lesson_comments: {
        Row: {
          contenido: string
          created_at: string
          es_respuesta_docente: boolean
          id: string
          modulo_id: string
          parent_id: string | null
          programa_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contenido: string
          created_at?: string
          es_respuesta_docente?: boolean
          id?: string
          modulo_id: string
          parent_id?: string | null
          programa_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contenido?: string
          created_at?: string
          es_respuesta_docente?: boolean
          id?: string
          modulo_id?: string
          parent_id?: string | null
          programa_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lesson_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      module_progress: {
        Row: {
          completado: boolean | null
          enrollment_id: string
          fecha_completado: string | null
          id: string
          modulo_id: string
          notas_estudiante: string | null
          tiempo_visto_segundos: number | null
        }
        Insert: {
          completado?: boolean | null
          enrollment_id: string
          fecha_completado?: string | null
          id?: string
          modulo_id: string
          notas_estudiante?: string | null
          tiempo_visto_segundos?: number | null
        }
        Update: {
          completado?: boolean | null
          enrollment_id?: string
          fecha_completado?: string | null
          id?: string
          modulo_id?: string
          notas_estudiante?: string | null
          tiempo_visto_segundos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "module_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_progress_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          comprobante_url: string | null
          created_at: string
          estado: string
          fecha_pago: string | null
          id: string
          metodo: string
          moneda: string
          monto: number
          notas: string | null
          procesado_por: string | null
          programa_id: string
          referencia: string | null
          user_id: string
        }
        Insert: {
          comprobante_url?: string | null
          created_at?: string
          estado?: string
          fecha_pago?: string | null
          id?: string
          metodo: string
          moneda?: string
          monto: number
          notas?: string | null
          procesado_por?: string | null
          programa_id: string
          referencia?: string | null
          user_id: string
        }
        Update: {
          comprobante_url?: string | null
          created_at?: string
          estado?: string
          fecha_pago?: string | null
          id?: string
          metodo?: string
          moneda?: string
          monto?: number
          notas?: string | null
          procesado_por?: string | null
          programa_id?: string
          referencia?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apellido: string
          avatar_url: string | null
          bio: string | null
          ciudad: string | null
          created_at: string
          especialidad: string | null
          id: string
          is_active: boolean | null
          linkedin_url: string | null
          nombre: string
          pais: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          apellido: string
          avatar_url?: string | null
          bio?: string | null
          ciudad?: string | null
          created_at?: string
          especialidad?: string | null
          id: string
          is_active?: boolean | null
          linkedin_url?: string | null
          nombre: string
          pais?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          apellido?: string
          avatar_url?: string | null
          bio?: string | null
          ciudad?: string | null
          created_at?: string
          especialidad?: string | null
          id?: string
          is_active?: boolean | null
          linkedin_url?: string | null
          nombre?: string
          pais?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      program_access_links: {
        Row: {
          activo: boolean | null
          created_at: string
          id: string
          meeting_id: string | null
          modulo_id: string | null
          password: string | null
          programa_id: string
          tipo: string
          url: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          id?: string
          meeting_id?: string | null
          modulo_id?: string | null
          password?: string | null
          programa_id: string
          tipo: string
          url: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          id?: string
          meeting_id?: string | null
          modulo_id?: string | null
          password?: string | null
          programa_id?: string
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_access_links_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_access_links_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_modules: {
        Row: {
          audio_url: string | null
          created_at: string
          descripcion: string | null
          docente_id: string | null
          duracion_minutos: number | null
          es_en_vivo: boolean | null
          fecha_sesion: string | null
          id: string
          material_url: string | null
          orden: number
          programa_id: string
          titulo: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          descripcion?: string | null
          docente_id?: string | null
          duracion_minutos?: number | null
          es_en_vivo?: boolean | null
          fecha_sesion?: string | null
          id?: string
          material_url?: string | null
          orden?: number
          programa_id: string
          titulo: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          descripcion?: string | null
          docente_id?: string | null
          duracion_minutos?: number | null
          es_en_vivo?: boolean | null
          fecha_sesion?: string | null
          id?: string
          material_url?: string | null
          orden?: number
          programa_id?: string
          titulo?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_modules_docente_id_fkey"
            columns: ["docente_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_modules_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          categoria_id: string | null
          certificado_incluido: boolean | null
          created_at: string
          descripcion: string
          destacado: boolean | null
          docente_id: string | null
          duracion_horas: number | null
          duracion_semanas: number | null
          estado: string
          fecha_fin: string | null
          fecha_inicio: string | null
          horario: string | null
          id: string
          imagen_url: string | null
          max_estudiantes: number | null
          min_estudiantes: number | null
          modalidad: string
          objetivos: string | null
          precio: number
          precio_descuento: number | null
          publico_meta: string | null
          resultados_esperados: string | null
          resumen: string | null
          slug: string
          syllabus_url: string | null
          tipo: string
          titulo: string
          updated_at: string
          video_intro_url: string | null
        }
        Insert: {
          categoria_id?: string | null
          certificado_incluido?: boolean | null
          created_at?: string
          descripcion: string
          destacado?: boolean | null
          docente_id?: string | null
          duracion_horas?: number | null
          duracion_semanas?: number | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          horario?: string | null
          id?: string
          imagen_url?: string | null
          max_estudiantes?: number | null
          min_estudiantes?: number | null
          modalidad: string
          objetivos?: string | null
          precio?: number
          precio_descuento?: number | null
          publico_meta?: string | null
          resultados_esperados?: string | null
          resumen?: string | null
          slug: string
          syllabus_url?: string | null
          tipo: string
          titulo: string
          updated_at?: string
          video_intro_url?: string | null
        }
        Update: {
          categoria_id?: string | null
          certificado_incluido?: boolean | null
          created_at?: string
          descripcion?: string
          destacado?: boolean | null
          docente_id?: string | null
          duracion_horas?: number | null
          duracion_semanas?: number | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          horario?: string | null
          id?: string
          imagen_url?: string | null
          max_estudiantes?: number | null
          min_estudiantes?: number | null
          modalidad?: string
          objetivos?: string | null
          precio?: number
          precio_descuento?: number | null
          publico_meta?: string | null
          resultados_esperados?: string | null
          resumen?: string | null
          slug?: string
          syllabus_url?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          video_intro_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_docente_id_fkey"
            columns: ["docente_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          apellido: string
          avatar_url: string | null
          biografia: string | null
          created_at: string
          email: string
          especialidad: string | null
          id: string
          linkedin_url: string | null
          nombre: string
          orden: number | null
          telefono: string | null
          titulo: string | null
          updated_at: string
          user_id: string | null
          visible: boolean | null
        }
        Insert: {
          apellido: string
          avatar_url?: string | null
          biografia?: string | null
          created_at?: string
          email: string
          especialidad?: string | null
          id?: string
          linkedin_url?: string | null
          nombre: string
          orden?: number | null
          telefono?: string | null
          titulo?: string | null
          updated_at?: string
          user_id?: string | null
          visible?: boolean | null
        }
        Update: {
          apellido?: string
          avatar_url?: string | null
          biografia?: string | null
          created_at?: string
          email?: string
          especialidad?: string | null
          id?: string
          linkedin_url?: string | null
          nombre?: string
          orden?: number | null
          telefono?: string | null
          titulo?: string | null
          updated_at?: string
          user_id?: string | null
          visible?: boolean | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          aprobado: boolean | null
          calificacion: number | null
          contenido: string
          created_at: string
          id: string
          imagen_url: string | null
          nombre: string
          ocupacion: string | null
          orden: number | null
          programa_id: string | null
        }
        Insert: {
          aprobado?: boolean | null
          calificacion?: number | null
          contenido: string
          created_at?: string
          id?: string
          imagen_url?: string | null
          nombre: string
          ocupacion?: string | null
          orden?: number | null
          programa_id?: string | null
        }
        Update: {
          aprobado?: boolean | null
          calificacion?: number | null
          contenido?: string
          created_at?: string
          id?: string
          imagen_url?: string | null
          nombre?: string
          ocupacion?: string | null
          orden?: number | null
          programa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "docente" | "estudiante"
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
      app_role: ["admin", "docente", "estudiante"],
    },
  },
} as const
