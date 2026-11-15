# The secret store of the Compose profile (ADR 0145): one OpenBao node with its data and its audit log on the volume
# "openbao". The keys and tokens come from .env through the service's variables; this file holds none.
ui = false
disable_mlock = true
api_addr = "http://openbao:8200"
cluster_addr = "http://127.0.0.1:8201"

listener "tcp" {
  # Only the profile's network reaches it: compose.yaml publishes no port of openbao.
  address = "0.0.0.0:8200"
  tls_disable = true
}

storage "raft" {
  path = "/openbao/file/raft"
  node_id = "openbao"
  # One node elects itself in about a second instead of five.
  performance_multiplier = 1
}

# Unseals itself at every start with the key OSF_OPENBAO_UNSEAL_KEY of .env: 32 bytes, as 64 hex digits.
seal "static" {
  current_key_id = "osf-1"
  current_key = "env://OSF_OPENBAO_UNSEAL_KEY"
}

# Every request and answer, with each secret value as an HMAC, never in clear text.
audit "file" "file" {
  options {
    file_path = "/openbao/file/audit.log"
  }
}

# On the first start only: the root token takes the ID OSF_OPENBAO_ROOT_TOKEN of .env, so the job openbao-setup can
# create the profile's tokens at every start. OpenBao revokes the token of its own initialization.
initialize "osf" {
  request "root-token" {
    operation = "update"
    path = "auth/token/create"
    data = {
      id = {
        eval_type = "string"
        eval_source = "env"
        env_var = "OSF_OPENBAO_ROOT_TOKEN"
        require_present = true
      }
      policies = ["root"]
      no_parent = true
      display_name = "osf-root"
    }
  }
}
