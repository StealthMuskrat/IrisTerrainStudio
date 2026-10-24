// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;
import java.nio.file.*;
import java.util.regex.Pattern;
/** The same original Java Pattern.asPredicate entry used by client filters. */
public final class NativeResourcePatternCheck {
    public static void main(String[] args)throws Exception{
        var rows=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonArray();var result=new JsonArray();
        for(var element:rows){var row=element.getAsJsonObject();var predicate=Pattern.compile(row.get("pattern").getAsString()).asPredicate();var matches=new JsonArray();for(var value:row.getAsJsonArray("values"))matches.add(predicate.test(value.getAsString()));result.add(matches);}
        Files.writeString(Path.of(args[1]),new Gson().toJson(result));
    }
}
