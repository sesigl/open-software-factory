package io.github.sesigl.osf.contracts;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.File;

/**
 * Round trip for {@code osf-contracts roundtrip --client java}. Arguments are Model=path pairs. Each fixture is
 * read into the generated model class and written back; one line {"file": path, "json": document} per fixture.
 */
public final class RoundTrip {
  private RoundTrip() {}

  public static void main(String[] args) throws Exception {
    ObjectMapper mapper = JSON.getDefault().getMapper();
    for (String pair : args) {
      int split = pair.indexOf('=');
      String model = pair.substring(0, split);
      String path = pair.substring(split + 1);
      Class<?> type = Class.forName("io.github.sesigl.osf.contracts.model." + model);
      Object value = mapper.readValue(new File(path), type);
      ObjectNode line = mapper.createObjectNode();
      line.put("file", path);
      line.set("json", mapper.readTree(mapper.writeValueAsString(value)));
      System.out.println(mapper.writeValueAsString(line));
    }
  }
}
