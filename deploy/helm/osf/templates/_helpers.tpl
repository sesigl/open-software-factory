{{/* The name of a component's resources: the release, then the component, like osf-foreman. */}}
{{- define "osf.name" -}}
{{- printf "%s-%s" .root.Release.Name .component | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "osf.labels" -}}
app.kubernetes.io/name: osf
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version }}
{{- end -}}

{{- define "osf.selector" -}}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "osf.image" -}}
{{- printf "%s/%s:%s" .root.Values.images.registry .name .tag -}}
{{- end -}}

{{/* The Secret with every secret: the chart's own, or secrets.existingSecret. */}}
{{- define "osf.secret" -}}
{{- default (printf "%s-secrets" .Release.Name) .Values.secrets.existingSecret -}}
{{- end -}}

{{- define "osf.secretEnv" -}}
- name: {{ .name }}
  valueFrom:
    secretKeyRef:
      name: {{ include "osf.secret" .root }}
      key: {{ .key }}
{{- end -}}

{{- define "osf.postgresHost" -}}
{{- if .Values.postgresql.enabled -}}
{{- printf "%s-postgres" .Release.Name -}}
{{- else -}}
{{- required "set externalDatabase.host or postgresql.enabled" .Values.externalDatabase.host -}}
{{- end -}}
{{- end -}}

{{- define "osf.postgresPort" -}}
{{- if .Values.postgresql.enabled -}}5432{{- else -}}{{ .Values.externalDatabase.port }}{{- end -}}
{{- end -}}

{{- define "osf.postgresUser" -}}
{{- if .Values.postgresql.enabled -}}osf{{- else -}}{{ .Values.externalDatabase.user }}{{- end -}}
{{- end -}}

{{/* The URL of one database; the password comes from POSTGRES_PASSWORD, which the container sets first. */}}
{{- define "osf.databaseUrl" -}}
{{- printf "postgres://%s:$(POSTGRES_PASSWORD)@%s:%s/%s" (include "osf.postgresUser" .root) (include "osf.postgresHost" .root) (include "osf.postgresPort" .root) .database -}}
{{- end -}}

{{- define "osf.natsUrl" -}}
{{- if .Values.nats.enabled -}}
{{- printf "nats://%s-nats:4222" .Release.Name -}}
{{- else -}}
{{- required "set externalNats.url or nats.enabled" .Values.externalNats.url -}}
{{- end -}}
{{- end -}}

{{- define "osf.temporalAddress" -}}
{{- if .Values.temporal.enabled -}}
{{- printf "%s-temporal:7233" .Release.Name -}}
{{- else -}}
{{- required "set externalTemporal.address or temporal.enabled" .Values.externalTemporal.address -}}
{{- end -}}
{{- end -}}

{{/*
An init container that waits for PostgreSQL and creates the databases in .databases when they are missing. It uses
the PostgreSQL image for psql, also with a managed PostgreSQL.
*/}}
{{- define "osf.databasesInit" -}}
- name: databases
  image: {{ .root.Values.postgresql.image }}
  imagePullPolicy: IfNotPresent
  command: [sh, -c]
  args:
    - |
      set -eu
      until pg_isready --quiet; do sleep 1; done
      for db in {{ join " " .databases }}; do
        tries=0
        until psql --quiet --tuples-only --no-align --command "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1 \
          || psql --quiet --command "CREATE DATABASE \"$db\""; do
          tries=$((tries + 1)); [ "$tries" -lt 30 ] || exit 1; sleep 1
        done
      done
  env:
    - name: PGHOST
      value: {{ include "osf.postgresHost" .root | quote }}
    - name: PGPORT
      value: {{ include "osf.postgresPort" .root | quote }}
    - name: PGUSER
      value: {{ include "osf.postgresUser" .root | quote }}
    - name: PGDATABASE
      value: {{ ternary "factory" .root.Values.externalDatabase.adminDatabase .root.Values.postgresql.enabled | quote }}
    {{- include "osf.secretEnv" (dict "root" .root "name" "PGPASSWORD" "key" "postgres-password") | nindent 4 }}
{{- end -}}

{{/* The volume of the factory definition: the ConfigMap, each file at its path. */}}
{{- define "osf.factoryVolume" -}}
- name: factory-source
  configMap:
    name: {{ .Release.Name }}-factory
    items:
      {{- range $path, $_ := include "osf.factoryFiles" . | fromYaml }}
      - key: {{ $path | replace "/" "__" }}
        path: {{ $path }}
      {{- end }}
{{- end -}}

{{/* The files of the factory as a YAML map from path to content: factory.files, or files/factory/. */}}
{{- define "osf.factoryFiles" -}}
{{- if .Values.factory.files -}}
{{- toYaml .Values.factory.files -}}
{{- else -}}
{{- $files := dict -}}
{{- range $path, $_ := .Files.Glob "files/factory/**" -}}
{{- $_ := set $files (trimPrefix "files/factory/" $path) ($.Files.Get $path) -}}
{{- end -}}
{{- toYaml $files -}}
{{- end -}}
{{- end -}}

{{/* A module answers its API on 8080; any answer below 500, like 401 without a token, means it is up. */}}
{{- define "osf.moduleProbe" -}}
readinessProbe:
  exec:
    command:
      - node
      - -e
      - 'fetch("http://127.0.0.1:8080{{ . }}").then((r) => process.exit(r.status < 500 ? 0 : 1), () => process.exit(1))'
  periodSeconds: 3
  timeoutSeconds: 5
  failureThreshold: 3
{{- end -}}

{{- define "osf.podSecurity" -}}
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
{{- end -}}

{{/* The Service of a module on port 8080. */}}
{{- define "osf.moduleService" -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "osf.name" . }}
  labels:
    {{- include "osf.labels" . | nindent 4 }}
spec:
  selector:
    {{- include "osf.selector" . | nindent 4 }}
  ports:
    - name: http
      port: 8080
{{- end -}}
